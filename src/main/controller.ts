import { BrowserWindow, Notification, app, globalShortcut, shell } from 'electron'
import { readFile, statfs } from 'node:fs/promises'
import { join } from 'node:path'
import type { DetectedMeeting, MeetingMeta, ModelStatus, PipelineStatus } from '../shared/types'
import { findFailed, findPending, markFailed, resetAttempts, type FailedSession } from './recovery'
import { Updater, type UpdateInfo } from './updater'
import { MeetingDetector } from './detector/index'
import { processRecording } from './pipeline/run'
import { ProcessingQueue, RecordingStore } from './recording'
import { getApiKey, getSettings, tr, updateSettings } from './settings'
import { WHISPER_MODELS, type WhisperModel } from '../shared/models'
import { downloadModel, findModel } from './setup/models'
import { whisperBinaries } from './setup/binaries'
import { LiveTranscriber } from './pipeline/live'
import { AppTray } from './tray'
import { createMainWindow, createPromptWindow, createWidgetWindow } from './windows'
import { elapsedSec, IDLE, type RecordingState } from '../shared/recording'
import { captureScreen } from './screenshot'
import { SHORTCUTS } from '../shared/shortcuts'
import { readNote, writeNote } from './library'
import { NotesWatcher } from './watcher'
import { friendlyError } from './errors'
import { summarize } from './pipeline/summarize'
import { rebuildWithSummary, splitMeetingNote, transcriptForSummary } from './pipeline/resummarize'

/** Estado do app inteiro: janelas, bandeja, detector, gravação e fila de processamento. */
export class Controller {
  main: BrowserWindow | null = null
  tray: AppTray | null = null
  prompt: BrowserWindow | null = null
  /** Widget flutuante enquanto grava: tempo, pausar e encerrar. */
  widget: BrowserWindow | null = null
  promptFor: DetectedMeeting | null = null
  model: ModelStatus = { ready: false }
  status: PipelineStatus = { stage: 'idle' }
  readonly store = new RecordingStore(() => getSettings().rootDir)
  readonly queue = new ProcessingQueue((s) => this.setStatus(s))
  readonly detector = new MeetingDetector((id) => getSettings().mutedApps.includes(id))
  update: UpdateInfo | null = null
  /** Avisa a janela quando as notas mudam no disco (Obsidian, sincronização, Explorer). */
  readonly watcher = new NotesWatcher(
    () => this.send('library:changed', {}),
    (rel) => this.send('note:changedOutside', { path: rel })
  )
  /** Transcrição durante a reunião, enquanto grava. */
  private live: LiveTranscriber | null = null
  /** Pastas de gravação na fila ou sendo processadas. */
  private readonly queued = new Set<string>()
  readonly updater = new Updater((info) => {
    this.update = info
    this.send('update:info', info)
  })

  async boot(): Promise<void> {
    this.main = createMainWindow()
    this.tray = new AppTray({
      open: () => this.show(),
      toggleRecording: () => this.send(this.store.current ? 'command:stop' : 'command:start', {}),
      quit: () => app.quit()
    })
    this.registerShortcuts()
    this.detector.on('start', (m) => this.onMeetingStart(m))
    this.detector.on('end', (m) => this.onMeetingEnd(m))
    if (getSettings().detectMeetings) await this.detector.start()
    this.watcher.start(getSettings().rootDir)
    await this.refreshModel()
    await this.recoverPending()
    if (getSettings().checkUpdates) this.updater.start()
  }

  /** Atalho global para gravar/parar, valendo com o app em segundo plano. */
  private registerShortcuts(): void {
    globalShortcut.register(SHORTCUTS.record, () => this.send(this.store.current ? 'command:stop' : 'command:start', {}))
    app.on('will-quit', () => globalShortcut.unregisterAll())
  }

  show(): void {
    if (!this.main) return
    if (this.main.isMinimized()) this.main.restore()
    this.main.show()
    this.main.focus()
  }

  send(channel: string, payload: unknown): void {
    this.main?.webContents.send(channel, payload)
  }

  setStatus(s: PipelineStatus): void {
    const waiting = Math.max(0, this.queue.size - 1)
    if (waiting > 0 && s.stage !== 'idle' && s.stage !== 'recording') s = { ...s, queued: waiting }
    this.status = s
    this.send('pipeline:status', s)
    if (s.stage === 'done') this.send('library:changed', { open: s.notePath })
  }

  recordingState(): RecordingState {
    const s = this.store.current
    if (!s) return IDLE
    return {
      recording: true,
      startedAt: s.startedAt.toISOString(),
      origin: s.origin ?? null,
      paused: Boolean(s.pausedAt),
      pausedMs: s.pausedMs,
      pausedAt: s.pausedAt?.toISOString() ?? null,
      shots: s.shots.length
    }
  }

  /** Avisa a janela principal e o widget; abre o widget ao começar e fecha ao terminar. */
  setRecording(recording: boolean): void {
    this.tray?.setRecording(recording)
    const state = this.recordingState()
    this.send('recording:state', state)
    if (recording && !this.widget) {
      this.widget = createWidgetWindow(getSettings().uiLanguage)
      this.widget.on('closed', () => (this.widget = null))
    }
    this.widget?.webContents.send('recording:state', state)
    if (!recording) this.widget?.close()
    // Capturar a tela só faz sentido gravando; fora disso o atalho fica livre para outros apps.
    if (recording && !globalShortcut.isRegistered(SHORTCUTS.capture)) globalShortcut.register(SHORTCUTS.capture, () => void this.captureShot())
    if (!recording && globalShortcut.isRegistered(SHORTCUTS.capture)) globalShortcut.unregister(SHORTCUTS.capture)
  }

  setPaused(paused: boolean): void {
    this.store.setPaused(paused)
    this.setRecording(Boolean(this.store.current))
  }

  /** Botões do widget: a gravação mora na janela principal, então a ordem vai para lá. */
  widgetCommand(cmd: 'pause' | 'resume' | 'stop' | 'capture'): void {
    if (cmd === 'capture') return void this.captureShot()
    if (!this.store.current) return
    this.send(`command:${cmd}`, {})
  }

  private selectedModel(): WhisperModel {
    return WHISPER_MODELS[getSettings().transcriptionQuality] ?? WHISPER_MODELS.best
  }

  async refreshModel(): Promise<ModelStatus> {
    if (this.model.downloading) return this.model
    const path = await findModel(app.getPath('userData'), this.selectedModel())
    this.model = path ? { ready: true, path } : { ready: false }
    this.send('model:status', this.model)
    return this.model
  }

  async downloadModel(): Promise<void> {
    if (this.model.downloading) return
    this.model = { ready: false, downloading: true, progress: 0 }
    this.send('model:status', this.model)
    try {
      await downloadModel(app.getPath('userData'), this.selectedModel(), (s) => {
        this.model = s
        this.send('model:status', s)
      })
    } catch (err) {
      this.model = { ready: false, error: (err as Error).message }
      this.send('model:status', this.model)
    }
  }

  /**
   * Avisa se o disco está quase cheio. Uma hora de reunião ocupa uns 45 MB de áudio, e o
   * processamento cria por pouco tempo uns 250 MB de wav.
   */
  async warnIfLowDisk(): Promise<void> {
    try {
      const fs = await statfs(getSettings().rootDir)
      const free = fs.bavail * fs.bsize
      if (free < 2 * 1024 ** 3) this.notify(tr().autoStop.lowDisk((free / 1024 ** 3).toFixed(1)))
    } catch {
      // Sem como medir: segue gravando.
    }
  }

  /** Gravação começou: transcreve em segundo plano para a nota sair logo depois do fim. */
  async startLive(sessionDir: string): Promise<void> {
    const settings = getSettings()
    if (!settings.liveTranscription) return
    const bins = await whisperBinaries()
    const chosen = this.selectedModel()
    const model = await findModel(app.getPath('userData'), chosen)
    if (!bins || !model || this.store.current?.dir !== sessionDir) return
    this.live = new LiveTranscriber({
      sessionDir,
      whisper: bins.binary,
      whisperFallback: bins.fallback,
      model,
      language: settings.language,
      greedy: chosen.greedy,
      busy: () => this.queue.size > 0
    })
    this.live.start()
  }

  /** Fecha a gravação e põe na fila: wav → Whisper → Haiku → .md. */
  async finishRecording(): Promise<void> {
    const live = this.live
    this.live = null
    const done = await this.store.finish()
    // Espera a rodada em curso gravar o progresso; o processamento final continua dali.
    await live?.stop()
    this.setRecording(false)
    if (!done) return
    const meta = JSON.parse(await readFile(join(done.session.dir, 'meta.json'), 'utf8'))
    await this.enqueue(done.session.dir, { ...meta, startedAt: new Date(meta.startedAt) })
  }

  /** Gravações que o app deixou para trás ao fechar: processa agora. */
  async recoverPending(): Promise<void> {
    const pending = await findPending(join(getSettings().rootDir, '.audio'))
    for (const p of pending) await this.enqueue(p.dir, p.meta)
    if (pending.length) this.notify(tr().autoStop.recovered(pending.length))
    const failed = await this.failedRecordings()
    if (failed.length) this.notify(tr().failed.title(failed.length))
  }

  private async enqueue(sessionDir: string, meta: MeetingMeta): Promise<void> {
    const settings = getSettings()
    const bins = await whisperBinaries()
    const chosen = this.selectedModel()
    const model = await findModel(app.getPath('userData'), chosen)
    if (!bins || !model) {
      this.setStatus({ stage: 'error', message: tr().main.missingWhisper })
      return
    }
    this.queued.add(sessionDir)
    this.queue.push(() =>
      this.runJob(sessionDir, () => processRecording(
        { sessionDir, meta },
        {
          rootDir: settings.rootDir,
          lang: settings.uiLanguage,
          meetingsFolder: settings.folders.meetings,
          whisper: bins.binary,
          whisperFallback: bins.fallback,
          model,
          greedy: chosen.greedy,
          language: settings.language,
          keepAudio: settings.keepAudio,
          drawFlows: settings.drawFlows,
          summary: { provider: settings.summaryProvider, apiKey: getApiKey() },
          onStatus: (s) => this.setStatus(s)
        }
      ))
    )
  }

  /** Roda o processamento; se der erro, guarda o motivo e avisa a janela da lista de problemas. */
  private async runJob(sessionDir: string, job: () => Promise<string>): Promise<void> {
    try {
      await job()
    } catch (err) {
      const message = friendlyError(err, tr().errors)
      await markFailed(sessionDir, message).catch(() => undefined)
      throw new Error(message, { cause: err })
    } finally {
      this.queued.delete(sessionDir)
      this.send('recordings:changed', {})
    }
  }

  /** Gravações que deram erro e não estão na fila agora. */
  async failedRecordings(): Promise<FailedSession[]> {
    const all = await findFailed(join(getSettings().rootDir, '.audio'))
    return all.filter((f) => !this.queued.has(f.dir))
  }

  async retryRecording(id: string): Promise<void> {
    const f = (await this.failedRecordings()).find((x) => x.id === id)
    if (!f) return
    await resetAttempts(f.dir)
    const meta = JSON.parse(await readFile(join(f.dir, 'meta.json'), 'utf8').catch(() => JSON.stringify({ startedAt: f.startedAt, durationSec: f.durationSec })))
    await this.enqueue(f.dir, { ...meta, startedAt: new Date(meta.startedAt) })
    this.send('recordings:changed', {})
  }

  /** Manda a pasta da gravação para a Lixeira do sistema (dá para recuperar de lá). */
  async discardRecording(id: string): Promise<void> {
    const f = (await this.failedRecordings()).find((x) => x.id === id)
    if (!f) return
    await shell.trashItem(f.dir)
    this.send('recordings:changed', {})
  }

  private onMeetingStart(m: DetectedMeeting): void {
    if (this.store.current || this.prompt) return
    this.promptFor = m
    this.prompt = createPromptWindow(m.appId, m.appName, getSettings().uiLanguage)
    this.prompt.on('closed', () => {
      this.prompt = null
      this.promptFor = null
    })
  }

  /** A chamada acabou: fecha o aviso e para a gravação, tenha ela começado pelo aviso ou pelo botão. */
  private onMeetingEnd(m: DetectedMeeting): void {
    if (this.prompt && this.promptFor?.appId === m.appId) this.prompt.close()
    if (!this.store.current || this.detector.anyInCall()) return
    this.send('command:stop', { reason: 'meeting-ended', app: m.appName })
  }

  /** Print da tela, marcado no tempo da reunião; vira imagem na transcrição e entra no resumo. */
  async captureShot(): Promise<void> {
    if (!this.store.current) return
    const offset = elapsedSec(this.recordingState())
    try {
      const shot = await captureScreen(this.widget)
      await this.store.addShot(shot.full, shot.small, offset)
      this.setRecording(true)
    } catch (err) {
      const t = tr().widget
      this.notify((err as Error).message === 'screen-permission' ? t.captureNoPermission : t.captureFailed)
    }
  }

  /** Gera o resumo de novo a partir da transcrição que está na nota. */
  async resummarize(rel: string): Promise<{ ok: true; markdown: string } | { ok: false; error: string }> {
    const settings = getSettings()
    const t = tr()
    try {
      const md = await readNote(settings.rootDir, rel)
      const parts = splitMeetingNote(md)
      if (!parts || !parts.transcript.trim()) return { ok: false, error: tr().note.noTranscript }
      const summary = await summarize(transcriptForSummary(parts.transcript), { provider: settings.summaryProvider, apiKey: getApiKey() })
      const next = rebuildWithSummary(parts, summary, settings.drawFlows)
      await writeNote(settings.rootDir, rel, next)
      return { ok: true, markdown: next }
    } catch (err) {
      return { ok: false, error: friendlyError(err, t.errors) }
    }
  }

  notify(body: string): void {
    if (Notification.isSupported()) new Notification({ title: 'TalkFlowBy', body, silent: true }).show()
  }

  async answerPrompt(answer: 'record' | 'later' | 'never'): Promise<void> {
    const m = this.promptFor
    this.prompt?.close()
    if (!m) return
    if (answer === 'record') this.send('command:start', { origin: m.appName })
    if (answer === 'never') {
      const muted = new Set(getSettings().mutedApps)
      muted.add(m.appId)
      await updateSettings({ mutedApps: [...muted] })
    }
  }
}
