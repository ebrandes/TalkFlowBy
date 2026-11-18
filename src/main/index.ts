import { app, nativeImage } from 'electron'
import { join } from 'node:path'
import { installSystemAudioCapture } from './capture'
import { Controller } from './controller'
import { registerIpc } from './ipc'
import { ensureRoot } from './library'
import { getSettings } from './settings'

// Uma instância só: abrir de novo apenas traz a janela para frente.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  const controller = new Controller()
  app.on('second-instance', () => controller.show())

  app.whenReady().then(async () => {
    app.setAppUserModelId('com.talkflowby.app')
    // Em desenvolvimento o Dock mostraria o ícone do Electron; no instalador o ícone vem do pacote.
    if (!app.isPackaged && process.platform === 'darwin') app.dock?.setIcon(nativeImage.createFromPath(join(process.cwd(), 'build', 'icon.png')))
    await ensureRoot(getSettings().rootDir, getSettings().folders)
    installSystemAudioCapture()
    registerIpc(controller)
    await controller.boot()
    if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: getSettings().openAtLogin, args: ['--hidden'] })
  })

  app.on('activate', () => controller.show())
  // Fechar todas as janelas não encerra: o app fica na bandeja.
  app.on('window-all-closed', () => undefined)
}
