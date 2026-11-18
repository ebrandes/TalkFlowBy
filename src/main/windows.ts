import { BrowserWindow, Notification, app, nativeTheme, screen, shell } from 'electron'
import { tr } from './settings'
import { join } from 'node:path'

const preload = (): string => join(__dirname, '../preload/index.cjs')

function load(win: BrowserWindow, page: 'index' | 'prompt' | 'widget', query = ''): void {
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
    // Mesma cor do fundo do app, para não piscar branco no tema escuro.
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#15181A' : '#F6F8F5',
    autoHideMenuBar: true,
    // A gravação roda nesta janela mesmo escondida; sem freio de segundo plano.
    webPreferences: { preload: preload(), sandbox: false, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false }
  })
  // Aberto junto com o sistema: começa escondido na bandeja.
  const atLogin = process.argv.includes('--hidden') || (process.platform === 'darwin' && app.getLoginItemSettings().wasOpenedAtLogin)
  win.once('ready-to-show', () => {
    if (!atLogin) win.show()
  })
  // Windows não tem a barra de menu do Mac; sem isto aparece "File Edit View" em inglês.
  if (process.platform !== 'darwin') win.removeMenu()
  // Fechar a janela só esconde; o app continua na bandeja ouvindo reuniões.
  let toldAboutTray = false
  win.on('close', (e) => {
    if (quitting) return
    e.preventDefault()
    win.hide()
    // No Windows o X costuma fechar o programa; avisa uma vez que ele segue na bandeja.
    if (process.platform === 'win32' && !toldAboutTray && Notification.isSupported()) {
      toldAboutTray = true
      new Notification({ title: 'TalkFlowBy', body: tr().main.stillInTray, silent: true }).show()
    }
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
    backgroundColor: process.platform === 'darwin' ? '#00000000' : nativeTheme.shouldUseDarkColors ? '#202528' : '#FBFCFA',
    webPreferences: { preload: preload(), sandbox: false, contextIsolation: true }
  })
  if (process.platform !== 'darwin') win.removeMenu()
  win.setAlwaysOnTop(true, 'floating')
  // skipTransformProcessType: sem isso o macOS some com a janela principal e o ícone do Dock
  // por um instante (e às vezes de vez), parecendo que o app fechou.
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true })
  win.once('ready-to-show', () => win.showInactive())
  load(win, 'prompt', `?app=${encodeURIComponent(appId)}&name=${encodeURIComponent(appName)}&lang=${lang}`)
  return win
}

/** Onde o widget estava quando foi arrastado; a próxima gravação abre no mesmo lugar. */
let widgetPos: { x: number; y: number } | null = null

/**
 * Pílula flutuante enquanto grava (como a do Notion): tempo, pausar e encerrar.
 * Fica por cima de tudo, em todas as áreas de trabalho, e não rouba o foco da reunião ao aparecer.
 */
export function createWidgetWindow(lang: string): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay()
  const width = 280
  const height = 52
  const fallback = { x: workArea.x + Math.round((workArea.width - width) / 2), y: workArea.y + 12 }
  // A posição salva só vale se ainda cabe numa tela (o monitor pode ter sido desligado).
  const fits = (p: { x: number; y: number }): boolean => {
    const a = screen.getDisplayMatching({ ...p, width, height }).workArea
    return p.x >= a.x && p.y >= a.y && p.x + width <= a.x + a.width && p.y + height <= a.y + a.height
  }
  const pos = widgetPos && fits(widgetPos) ? widgetPos : fallback
  const win = new BrowserWindow({
    width,
    height,
    ...pos,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    backgroundColor: '#00000000',
    title: 'TalkFlowBy',
    webPreferences: { preload: preload(), sandbox: false, contextIsolation: true }
  })
  if (process.platform !== 'darwin') win.removeMenu()
  win.setAlwaysOnTop(true, 'floating')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true })
  win.on('moved', () => {
    const [x, y] = win.getPosition()
    widgetPos = { x, y }
  })
  win.once('ready-to-show', () => win.showInactive())
  load(win, 'widget', `?lang=${lang}`)
  return win
}
