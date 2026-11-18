import { app, shell } from 'electron'
import electronUpdater from 'electron-updater'
import { isNewer } from '../shared/version'

const REPO = 'ebrandes/TalkFlowBy'
const RELEASES = `https://github.com/${REPO}/releases/latest`
const EVERY_MS = 6 * 60 * 60 * 1000

export interface UpdateInfo {
  version: string
  /** "ready": baixada e pronta para instalar (Windows). "available": só avisar e abrir o download (Mac). */
  state: 'available' | 'ready'
}

/**
 * Procura versão nova no GitHub. No Windows baixa e instala ao reiniciar; no Mac, sem a
 * assinatura da Apple, o sistema não deixa o app se trocar sozinho, então só avisa.
 */
export class Updater {
  private timer: NodeJS.Timeout | null = null

  constructor(private onUpdate: (info: UpdateInfo) => void) {}

  start(): void {
    if (!app.isPackaged || this.timer) return
    if (process.platform === 'win32') {
      const { autoUpdater } = electronUpdater
      autoUpdater.autoDownload = true
      autoUpdater.autoInstallOnAppQuit = true
      autoUpdater.on('update-downloaded', (info) => this.onUpdate({ version: info.version, state: 'ready' }))
      autoUpdater.on('error', () => undefined)
    }
    void this.check()
    this.timer = setInterval(() => void this.check(), EVERY_MS)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  async check(): Promise<void> {
    try {
      if (process.platform === 'win32') {
        await electronUpdater.autoUpdater.checkForUpdates()
        return
      }
      const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'TalkFlowBy' }
      })
      if (!res.ok) return
      const latest = ((await res.json()) as { tag_name?: string }).tag_name ?? ''
      if (latest && isNewer(latest, app.getVersion())) this.onUpdate({ version: latest.replace(/^v/, ''), state: 'available' })
    } catch {
      // Sem internet ou GitHub fora do ar: tenta de novo na próxima volta.
    }
  }

  apply(info: UpdateInfo): void {
    if (info.state === 'ready') electronUpdater.autoUpdater.quitAndInstall()
    else void shell.openExternal(RELEASES)
  }
}
