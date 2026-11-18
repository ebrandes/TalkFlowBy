import type { DetectedMeeting } from '../../shared/types'

interface KnownApp {
  /** Identificador estável usado no "Nunca para este app". */
  id: string
  name: string
  /** Prefixos de bundle ID no Mac (os navegadores usam processos "helper"). */
  mac: string[]
  /** Trechos do nome da chave do registro no Windows (caminho do .exe ou pacote). */
  win: string[]
}

const BROWSER_NOTE = 'Google Meet'

export const KNOWN_APPS: KnownApp[] = [
  { id: 'teams', name: 'Microsoft Teams', mac: ['com.microsoft.teams'], win: ['msteams', 'ms-teams.exe', 'teams.exe'] },
  { id: 'chrome', name: `${BROWSER_NOTE} (Chrome)`, mac: ['com.google.chrome'], win: ['chrome.exe'] },
  { id: 'edge', name: `${BROWSER_NOTE} (Edge)`, mac: ['com.microsoft.edgemac'], win: ['msedge.exe'] },
  { id: 'safari', name: `${BROWSER_NOTE} (Safari)`, mac: ['com.apple.safari', 'com.apple.webkit'], win: [] },
  { id: 'arc', name: `${BROWSER_NOTE} (Arc)`, mac: ['company.thebrowser.browser'], win: ['arc.exe'] },
  { id: 'firefox', name: `${BROWSER_NOTE} (Firefox)`, mac: ['org.mozilla.firefox'], win: ['firefox.exe'] },
  { id: 'brave', name: `${BROWSER_NOTE} (Brave)`, mac: ['com.brave.browser'], win: ['brave.exe'] },
  { id: 'zoom', name: 'Zoom', mac: ['us.zoom.xos'], win: ['zoom.exe'] }
]

/** O próprio app também usa o microfone ao gravar; nunca conta como reunião. */
const SELF = ['com.talkflowby', 'com.github.electron', 'talkflowby', 'electron.exe']

export function isSelf(identifier: string): boolean {
  const id = identifier.toLowerCase()
  return SELF.some((s) => id.includes(s))
}

export function matchMac(bundleId: string): DetectedMeeting | null {
  const id = bundleId.toLowerCase()
  if (isSelf(id)) return null
  const app = KNOWN_APPS.find((a) => a.mac.some((p) => id.startsWith(p)))
  return app ? { appId: app.id, appName: app.name } : null
}

/** Processos que só hospedam o áudio de outro app; quem conta é o pai. */
const HOSTS = ['msedgewebview2.exe']

/**
 * Acha o app de reunião pela cadeia de processos do `micwatch.exe` (quem captura, depois os pais).
 * Sobe só por hospedeiros (WebView2) e processos auxiliares do mesmo .exe: um programa aberto
 * a partir do navegador não vira "Google Meet".
 */
export function matchWindowsChain(chain: string[]): DetectedMeeting | null {
  const names = chain.map((n) => n.toLowerCase())
  let i = 0
  while (i < names.length - 1 && (HOSTS.includes(names[i]) || names[i + 1] === names[i])) i++
  const exe = names[i]
  if (!exe || HOSTS.includes(exe) || isSelf(exe)) return null
  const app = KNOWN_APPS.find((a) => a.win.some((p) => p.endsWith('.exe') && p === exe))
  return app ? { appId: app.id, appName: app.name } : null
}

export function matchWindows(registryKey: string): DetectedMeeting | null {
  const key = registryKey.toLowerCase()
  if (isSelf(key)) return null
  const app = KNOWN_APPS.find((a) => a.win.some((p) => key.includes(p)))
  return app ? { appId: app.id, appName: app.name } : null
}
