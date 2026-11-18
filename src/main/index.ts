import { app, nativeImage, net, protocol } from 'electron'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { installSystemAudioCapture } from './capture'
import { Controller } from './controller'
import { registerIpc } from './ipc'
import { ensureRoot, resolveInside } from './library'
import { getSettings } from './settings'

// Imagens da pasta de notas (o diagrama do fluxo) chegam ao editor por "tfb-file://note/<caminho>".
protocol.registerSchemesAsPrivileged([{ scheme: 'tfb-file', privileges: { standard: true, secure: true, supportFetchAPI: true } }])

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
    protocol.handle('tfb-file', (req) => {
      try {
        const rel = decodeURIComponent(new URL(req.url).pathname.replace(/^\//, ''))
        if (!/\.(svg|png|jpe?g|gif|webp)$/i.test(rel)) return new Response(null, { status: 403 })
        return net.fetch(pathToFileURL(resolveInside(getSettings().rootDir, rel)).toString())
      } catch {
        return new Response(null, { status: 404 })
      }
    })
    installSystemAudioCapture()
    registerIpc(controller)
    await controller.boot()
    if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: getSettings().openAtLogin, args: ['--hidden'] })
  })

  app.on('activate', () => controller.show())

  // Fechar o app no meio de uma gravação (inclusive pelo "Sair e Reabrir" do macOS) salva o que
  // já foi gravado; na próxima abertura ela é processada.
  let closingRecording = false
  app.on('before-quit', (e) => {
    if (!controller.store.current || closingRecording) return
    e.preventDefault()
    closingRecording = true
    void controller.store.finish().finally(() => app.quit())
  })
  // Fechar todas as janelas não encerra: o app fica na bandeja.
  app.on('window-all-closed', () => undefined)
}
