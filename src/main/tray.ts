import { Menu, Tray, app, nativeImage } from 'electron'
import { join } from 'node:path'

export interface TrayActions {
  open: () => void
  toggleRecording: () => void
  quit: () => void
}

function trayDir(): string {
  return app.isPackaged ? join(process.resourcesPath, 'tray') : join(process.cwd(), 'resources', 'tray')
}

function icon(recording: boolean): Electron.NativeImage {
  const name = recording ? 'recording' : 'idle'
  if (process.platform === 'darwin') {
    const img = nativeImage.createFromPath(join(trayDir(), `${name}Template.png`))
    img.setTemplateImage(true)
    return img
  }
  return nativeImage.createFromPath(join(trayDir(), `${name}-win.png`))
}

export class AppTray {
  private tray: Tray
  private recording = false

  constructor(private actions: TrayActions) {
    this.tray = new Tray(icon(false))
    this.tray.setToolTip('TalkFlowBy')
    this.tray.on('click', () => (process.platform === 'win32' ? actions.open() : undefined))
    this.render()
  }

  setRecording(recording: boolean): void {
    this.recording = recording
    this.tray.setImage(icon(recording))
    this.tray.setToolTip(recording ? 'TalkFlowBy — gravando' : 'TalkFlowBy')
    this.render()
  }

  private render(): void {
    const menu = Menu.buildFromTemplate([
      { label: 'Abrir TalkFlowBy', click: this.actions.open },
      { type: 'separator' },
      { label: this.recording ? 'Parar gravação' : 'Gravar reunião', click: this.actions.toggleRecording },
      { type: 'separator' },
      { label: 'Sair', click: this.actions.quit }
    ])
    this.tray.setContextMenu(menu)
  }
}
