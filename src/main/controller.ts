import { BrowserWindow, app } from 'electron'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DetectedMeeting, ModelStatus, PipelineStatus } from '../shared/types'
import { MeetingDetector } from './detector/index'
import { processRecording } from './pipeline/run'
import { ProcessingQueue, RecordingStore } from './recording'
import { getApiKey, getSettings, tr, updateSettings } from './settings'
import { downloadModel, findModel } from './setup/models'
import { whisperPath } from './setup/binaries'
import { AppTray } from './tray'
import { createMainWindow, createPromptWindow } from './windows'

/** Estado do app inteiro: janelas, bandeja, detector, gravação e fila de processamento. */
export class Controller {
  main: BrowserWindow | null = null
  tray: AppTray | null = null
  prompt: BrowserWindow | null = null
  promptFor: DetectedMeeting | null = null
  model: ModelStatus = { ready: false }
  status: PipelineStatus = { stage: 'idle' }
  readonly store = new RecordingStore(() => getSettings().rootDir)
  readonly queue = new ProcessingQueue((s) => this.setStatus(s))
  readonly detector = new MeetingDetector((id) => getSettings().mutedApps.includes(id))

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
    if (s.stage === 'done') this.send('library:changed', { open: s.notePath })
  }

  setRecording(recording: boolean): void {
    this.tray?.setRecording(recording)
    this.send('recording:state', { recording, startedAt: this.store.current?.startedAt ?? null, origin: this.store.current?.origin ?? null })
  }

  async refreshModel(): Promise<ModelStatus> {
    const path = await findModel(app.getPath('userData'))
    this.model = path ? { ready: true, path } : { ready: false }
    this.send('model:status', this.model)
    return this.model
  }

  async downloadModel(): Promise<void> {
    if (this.model.downloading) return
    this.model = { ready: false, downloading: true, progress: 0 }
    this.send('model:status', this.model)
    try {
      await downloadModel(app.getPath('userData'), (s) => {
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
    const settings = getSettings()
    const whisper = await whisperPath()
    const model = this.model.path ?? (await findModel(app.getPath('userData')))
    if (!whisper || !model) {
      this.setStatus({ stage: 'error', message: tr().main.missingWhisper })
      return
    }
    const meta = JSON.parse(await readFile(join(done.session.dir, 'meta.json'), 'utf8'))
    this.queue.push(() =>
      processRecording(
        { sessionDir: done.session.dir, meta: { ...meta, startedAt: new Date(meta.startedAt) } },
        {
          rootDir: settings.rootDir,
          lang: settings.uiLanguage,
          meetingsFolder: settings.folders.meetings,
          whisper,
          model,
          language: settings.language,
          keepAudio: settings.keepAudio,
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

  private onMeetingEnd(m: DetectedMeeting): void {
    if (this.prompt && this.promptFor?.appId === m.appId) this.prompt.close()
    const rec = this.store.current
    if (rec && rec.origin === m.appName) this.send('command:stop', { reason: 'meeting-ended' })
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
