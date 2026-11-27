import { BrowserWindow, Notification, app, globalShortcut, net, shell } from 'electron'
import { readFile, statfs } from 'node:fs/promises'
import { join } from 'node:path'
import type { DetectedMeeting, MeetingMeta, ModelStatus, PipelineStatus } from '../shared/types'
import { findFailed, findPending, markFailed, resetAttempts, type FailedSession } from './recovery'
import { Updater, type UpdateInfo } from './updater'
import { MeetingDetector, type CallInfo } from './detector/index'
import { SummaryRetry } from './summary-retry'
import { processRecording } from './pipeline/run'
import { detectVoices } from './voices'
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
import { SyncService } from './sync-service'

/** Gravação automática mais curta que isso (segundos) não vira nota. */
const MIN_AUTO_SEC = 20
/** Conferências (a cada 15 s) com som ainda tocando antes de encerrar mesmo assim: 3 minutos. */
const END_FORCE_TRIES = 12

/** Estado do app inteiro: janelas, bandeja, detector, gravação e fila de processamento. */
export class Controller {
  main: BrowserWindow | null = null
  tray: AppTray | null = null
  prompt: BrowserWindow | null = null
  /** Widget flutuante enquanto grava: tempo, pausar e encerrar. */
  widget: BrowserWindow | null = null
  promptFor: CallInfo | null = null
  model: ModelStatus = { ready: false }
  status: PipelineStatus = { stage: 'idle' }
  readonly store = new RecordingStore(() => getSettings().rootDir)
  readonly queue = new ProcessingQueue((s) => this.setStatus(s))
  readonly detector = new MeetingDetector((id) => getSettings().mutedApps.includes(id))
  update: UpdateInfo | null = null
  /** Notas salvas sem resumo (sem internet): o resumo é gerado quando der. */
  readonly summaryRetry = new SummaryRetry(
    join(app.getPath('userData'), 'summary-retry.json'),
    () => getSettings().rootDir,
    (rel) => this.resummarize(rel),
    () => net.isOnline(),
    (paths) => {
      for (const rel of paths) this.send('note:changedOutside', { path: rel })
      this.send('library:changed', {})
      this.notify(tr().autoStop.summaryRetried(paths.length))
    }
  )
  /** A chamada acabou mas ainda havia som: confere de novo até a gravação parar ou a chamada voltar. */
  private endCheck: NodeJS.Timeout | null = null
  /** Avisa a janela quando as notas mudam no disco (Obsidian, sincronização, Explorer). */
  readonly watcher = new NotesWatcher(
    () => this.send('library:changed', {}),
    (rel) => this.send('note:changedOutside', { path: rel })
  )
  /** Transcrição durante a reunião, enquanto grava. */
  private live: LiveTranscriber | null = null
  /** Pastas de gravação na fila ou sendo processadas. */
  private readonly queued = new Set<string>()
  /** Sincronização das notas com o repositório Git, quando configurada. */
  readonly sync = new SyncService(
    (s) => this.send('sync:status', s),
    (r) => this.send('library:changed', { synced: r.pulled })
  )
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
    this.detector.on('switch', (from, to) => this.onMeetingSwitch(from, to))
    if (getSettings().detectMeetings) await this.detector.start()
    this.watcher.start(getSettings().rootDir)
    await this.refreshModel()
    await this.recoverPending()
    if (getSettings().checkUpdates) this.updater.start()
    this.sync.restart()
    this.summaryRetry.start()
    setTimeout(() => void this.summaryRetry.run(), 30_000)
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
    if (s.stage === 'done') {
      this.send('library:changed', { open: s.notePath })
      void this.sync.now()
    }
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
    // Gravação automática de poucos segundos: tela de teste, entrou e saiu. Vai para a Lixeira.
    if (done.session.auto && done.durationSec < MIN_AUTO_SEC) {
      await shell.trashItem(done.session.dir).catch(() => undefined)
      return
    }
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
          voices: settings.separateVoices ? detectVoices : undefined,
          summary: { provider: settings.summaryProvider, apiKey: getApiKey() },
          onStatus: (s) => this.setStatus(s),
          onSummaryFailed: (rel) => void this.summaryRetry.add(rel),
          // Gravação automática sem nenhuma fala (alguém deixou o Teams aberto): não vira nota vazia.
          discardEmpty: meta.auto ? (dir) => shell.trashItem(dir).catch(() => undefined) : undefined
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

  private onMeetingStart(m: CallInfo): void {
    this.cancelEndCheck()
    if (this.store.current) {
      // Gravação já em curso (pelo botão ou de antes da queda): passa a acompanhar esta chamada.
      if (!this.store.current.appId) this.store.current.appId = m.appId
      return
    }
    if (getSettings().autoRecord && m.confident) {
      if (this.prompt) this.prompt.close()
      this.startAuto(m)
      this.notify(tr().autoStop.autoStarted(m.appName, m.title))
      return
    }
    if (this.prompt) return
    this.promptFor = m
    this.prompt = createPromptWindow(m.appId, m.appName, getSettings().uiLanguage)
    this.prompt.on('closed', () => {
      this.prompt = null
      this.promptFor = null
    })
  }

  private startAuto(m: CallInfo, restart = false): void {
    this.send('command:start', { origin: m.appName, title: m.title, auto: true, appId: m.appId, restart })
  }

  /** A chamada acabou: fecha o aviso e para a gravação, tenha ela começado pelo aviso ou pelo botão. */
  private onMeetingEnd(m: DetectedMeeting): void {
    if (this.prompt && this.promptFor?.appId === m.appId) this.prompt.close()
    if (!this.store.current || this.detector.anyInCall()) return
    this.send('command:stop', { reason: 'meeting-ended', app: m.appName })
    // A janela só para se não houver mais som; enquanto houver, confere de novo.
    // Depois de uns minutos encerra de qualquer jeito (música tocando depois da reunião, por exemplo).
    this.cancelEndCheck()
    let tries = 0
    this.endCheck = setInterval(() => {
      if (!this.store.current || this.detector.anyInCall()) return this.cancelEndCheck()
      tries++
      this.send('command:stop', { reason: 'meeting-ended', app: m.appName, force: tries >= END_FORCE_TRIES })
    }, 15_000)
  }

  private cancelEndCheck(): void {
    if (this.endCheck) clearInterval(this.endCheck)
    this.endCheck = null
  }

  /** Saiu de uma reunião e entrou em outra: fecha a gravação da primeira e começa a da segunda. */
  private onMeetingSwitch(from: CallInfo, to: CallInfo): void {
    this.cancelEndCheck()
    const rec = this.store.current
    if (!rec || (rec.appId && rec.appId !== from.appId)) return this.onMeetingStart(to)
    if (getSettings().autoRecord && to.confident) {
      this.startAuto(to, true)
      this.notify(tr().autoStop.switched(to.appName, to.title))
      return
    }
    // Sem gravar sozinho: encerra a anterior e pergunta pela nova.
    this.send('command:stop', { reason: 'meeting-switched', app: from.appName })
    void this.whenStopped().then(() => this.onMeetingStart(to))
  }

  /** Espera a gravação atual fechar (até uns 15 s). */
  private async whenStopped(): Promise<void> {
    for (let i = 0; i < 30 && this.store.current; i++) await new Promise((r) => setTimeout(r, 500))
  }

  /** A gravação parou por silêncio, mas a chamada pode continuar: se continuar, grava de novo. */
  onSilenceStopped(): void {
    for (const id of ['teams', 'chrome', 'edge', 'firefox', 'brave', 'arc', 'safari', 'zoom']) {
      if (this.detector.inCall(id) && this.detector.isActive(id)) this.detector.rearm(id)
    }
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
    if (answer === 'record') this.send('command:start', { origin: m.appName, title: m.title, appId: m.appId })
    if (answer === 'never') {
      const muted = new Set(getSettings().mutedApps)
      muted.add(m.appId)
      await updateSettings({ mutedApps: [...muted] })
    }
  }
}
