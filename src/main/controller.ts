import { BrowserWindow, Notification, app } from 'electron'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DetectedMeeting, MeetingMeta, ModelStatus, PipelineStatus } from '../shared/types'
import { findPending } from './recovery'
import { Updater, type UpdateInfo } from './updater'
import { MeetingDetector } from './detector/index'
import { processRecording } from './pipeline/run'
import { ProcessingQueue, RecordingStore } from './recording'
import { getApiKey, getSettings, tr, updateSettings } from './settings'
import { WHISPER_MODELS, type WhisperModel } from '../shared/models'
import { downloadModel, findModel } from './setup/models'
import { whisperPath } from './setup/binaries'
import { AppTray } from './tray'
import { createMainWindow, createPromptWindow, createWidgetWindow } from './windows'
import { elapsedSec, IDLE, type RecordingState } from '../shared/recording'
import { captureScreen } from './screenshot'
import { SyncService } from './sync-service'

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
    this.detector.on('start', (m) => this.onMeetingStart(m))
    this.detector.on('end', (m) => this.onMeetingEnd(m))
    if (getSettings().detectMeetings) await this.detector.start()
    await this.refreshModel()
    await this.recoverPending()
    if (getSettings().checkUpdates) this.updater.start()
    this.sync.restart()
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

  /** Fecha a gravação e põe na fila: wav → Whisper → Haiku → .md. */
  async finishRecording(): Promise<void> {
    const done = await this.store.finish()
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
  }

  private async enqueue(sessionDir: string, meta: MeetingMeta): Promise<void> {
    const settings = getSettings()
    const whisper = await whisperPath()
    const chosen = this.selectedModel()
    const model = await findModel(app.getPath('userData'), chosen)
    if (!whisper || !model) {
      this.setStatus({ stage: 'error', message: tr().main.missingWhisper })
      return
    }
    this.queue.push(() =>
      processRecording(
        { sessionDir, meta },
        {
          rootDir: settings.rootDir,
          lang: settings.uiLanguage,
          meetingsFolder: settings.folders.meetings,
          whisper,
          model,
          greedy: chosen.greedy,
          language: settings.language,
          keepAudio: settings.keepAudio,
          drawFlows: settings.drawFlows,
          summary: { provider: settings.summaryProvider, apiKey: getApiKey() },
          onStatus: (s) => this.setStatus(s)
        }
      )
    )
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
