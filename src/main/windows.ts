import { BrowserWindow, app, screen, shell } from 'electron'
import { join } from 'node:path'

const preload = (): string => join(__dirname, '../preload/index.cjs')

function load(win: BrowserWindow, page: 'index' | 'prompt', query = ''): void {
  const dev = process.env.ELECTRON_RENDERER_URL
  if (dev) void win.loadURL(`${dev}/${page}.html${query}`)
  else void win.loadFile(join(__dirname, `../renderer/${page}.html`), { search: query.replace(/^\?/, '') })
}

let quitting = false
app.on('before-quit', () => (quitting = true))

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 760,
    minHeight: 520,
    show: false,
    title: 'TalkFlowBy',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: '#EEF1EC',
    // A gravação roda nesta janela mesmo escondida; sem freio de segundo plano.
    webPreferences: { preload: preload(), sandbox: false, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false }
  })
  // Aberto junto com o sistema: começa escondido na bandeja.
  const atLogin = process.argv.includes('--hidden') || (process.platform === 'darwin' && app.getLoginItemSettings().wasOpenedAtLogin)
  win.once('ready-to-show', () => {
    if (!atLogin) win.show()
  })
  // Fechar a janela só esconde; o app continua na bandeja ouvindo reuniões.
  win.on('close', (e) => {
    if (quitting) return
    e.preventDefault()
    win.hide()
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  load(win, 'index')
  return win
}

/** Janela pequena no canto superior direito, sempre por cima, sem roubar o foco da reunião. */
export function createPromptWindow(appId: string, appName: string, lang: string): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay()
  const width = 360
  const height = 164
  const win = new BrowserWindow({
    width,
    height,
    x: workArea.x + workArea.width - width - 16,
    y: workArea.y + 16,
    frame: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    transparent: process.platform === 'darwin',
    backgroundColor: process.platform === 'darwin' ? '#00000000' : '#F7F9F6',
    webPreferences: { preload: preload(), sandbox: false, contextIsolation: true }
  })
  win.setAlwaysOnTop(true, 'floating')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  win.once('ready-to-show', () => win.showInactive())
  load(win, 'prompt', `?app=${encodeURIComponent(appId)}&name=${encodeURIComponent(appName)}&lang=${lang}`)
  return win
}
