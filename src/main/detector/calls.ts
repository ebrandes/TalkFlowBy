/**
 * Descobre *qual* reunião está aberta pelos títulos das janelas (só no Windows, via `micwatch.exe`).
 * O microfone diz que existe uma chamada; o título diz qual é: a janela da reunião do Teams,
 * a aba do Google Meet. É isso que separa uma chamada da seguinte e segura a gravação durante
 * uma queda de internet, enquanto a janela da reunião continua aberta.
 */

export interface WindowInfo {
  /** Nome do .exe dono da janela, como `ms-teams.exe`. */
  exe: string
  title: string
}

export interface CallIdentity {
  /** Chave estável da reunião (igual enquanto for a mesma chamada). */
  key: string
  /** Nome da reunião para a nota, quando o título traz um. */
  title?: string
  /** O título tem o formato da reunião (código do Meet), não depende de quando a janela abriu. */
  strong: boolean
}

const TEAMS_EXES = ['ms-teams.exe', 'teams.exe', 'msedgewebview2.exe']
export const BROWSER_EXES: Record<string, string> = {
  chrome: 'chrome.exe',
  edge: 'msedge.exe',
  firefox: 'firefox.exe',
  brave: 'brave.exe',
  arc: 'arc.exe'
}

/** Seções da janela principal do Teams (não são reuniões), em inglês e português. */
const TEAMS_NAV = [
  'activity', 'atividade', 'chat', 'chats', 'conversas', 'teams', 'equipes', 'calendar', 'calendario', 'calls', 'chamadas',
  'files', 'arquivos', 'apps', 'aplicativos', 'onedrive', 'communities', 'comunidades', 'copilot', 'help', 'ajuda', 'settings',
  'configuracoes', 'search', 'pesquisa', 'pesquisar', 'people', 'pessoas', 'planner', 'approvals', 'aprovacoes', 'shifts', 'turnos',
  'meet', 'reunir', 'home', 'inicio', 'contacts', 'contatos', 'notifications', 'notificacoes', 'saved', 'salvos', 'loading', 'carregando'
]
/** Janelas auxiliares do Teams que não são a reunião. */
const TEAMS_SKIP = /notifica|notification|sharing control|controle de compartilhamento|barra de controle|control bar|toast|update|atualiza/i

const fold = (s: string): string => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

/** "Daily | Microsoft Teams" → "Daily"; seções da janela principal e janelas auxiliares → null. */
export function teamsTitle(title: string): string | null {
  // No navegador vem depois " - Google Chrome" ou parecido; o que importa é o que vem antes do "| Microsoft Teams".
  const parts = title.split(/\s+\|\s+/).map((p) => p.trim()).filter(Boolean)
  const kept = parts.filter((p) => !/^microsoft teams\b/i.test(p))
  if (kept.length === 0) return null
  if (TEAMS_NAV.includes(fold(kept[0]))) return null
  const name = kept.join(' | ')
  if (TEAMS_SKIP.test(name)) return null
  return name
}

const MEET_CODE = /\b([a-z]{3}-[a-z]{4}-[a-z]{3})\b/
const BROWSER_SUFFIX = /\s+[-–—]\s+(?:[^-–—]+\s+[-–—]\s+)?(?:google chrome|microsoft\s*\u200b?\s*edge|mozilla firefox|firefox|brave|arc)\s*$/i

/** Aba do Google Meet: "Meet - abc-defg-hij - Google Chrome", "Meet: Daily - Google Chrome". */
export function meetTitle(title: string): CallIdentity | null {
  const clean = title.replace(BROWSER_SUFFIX, '').trim()
  const m = clean.match(/^(?:google\s+)?meet\s*[-–—:]\s*(.+)$/i)
  if (!m) return null
  const rest = m[1].trim()
  const code = rest.match(MEET_CODE)?.[1]
  const name = rest.replace(MEET_CODE, '').replace(/^[\s\-–—:|]+|[\s\-–—:|]+$/g, '').trim()
  if (!code && !name) return null
  return { key: `meet:${code ?? fold(name)}`, title: name || undefined, strong: true }
}

/** As reuniões que as janelas de um app mostram agora. */
export function callsInWindows(appId: string, windows: WindowInfo[]): CallIdentity[] {
  const out = new Map<string, CallIdentity>()
  const add = (c: CallIdentity | null): void => {
    if (c && !out.has(c.key)) out.set(c.key, c)
  }
  for (const w of windows) {
    const exe = w.exe.toLowerCase()
    if (appId === 'teams' && TEAMS_EXES.includes(exe)) {
      const name = teamsTitle(w.title)
      if (name) add({ key: `teams:${fold(name)}`, title: name, strong: false })
    } else if (BROWSER_EXES[appId] === exe) {
      add(meetTitle(w.title))
      // Teams no navegador.
      if (/\|\s*microsoft teams/i.test(w.title)) {
        const name = teamsTitle(w.title.replace(BROWSER_SUFFIX, ''))
        if (name) add({ key: `teams:${fold(name)}`, title: name, strong: false })
      }
    } else if (appId === 'zoom' && exe === 'zoom.exe' && /zoom\s+(meeting|reuni)|reuni[aã]o\s+(do\s+)?zoom|zoom workplace.*meeting/i.test(w.title)) {
      add({ key: 'zoom:meeting', strong: true })
    }
  }
  return [...out.values()]
}

export function isBrowser(appId: string): boolean {
  return appId in BROWSER_EXES || appId === 'safari'
}
