/** Rótulo "Outros" das notas, nos idiomas do app. */
const OTHERS = ['Outros', 'Others']

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const LABELS = OTHERS.map(escapeRe).join('|')
/** Início de uma fala da transcrição: "**00:12 · Outros 2:**". */
const LINE = new RegExp(`\\*\\*\\d{1,2}:\\d{2}(?::\\d{2})? · ((?:${LABELS})(?: \\d{1,2})?):\\*\\*`, 'g')

const cleanName = (name: string): string => name.replace(/[*_`[\]\\]/g, '').trim()

/** Rótulos de "Outros" que aparecem na transcrição ("Outros", ou "Outros 1", "Outros 2"…), na ordem em que aparecem. */
export function othersLabels(markdown: string): string[] {
  const seen: string[] = []
  for (const m of markdown.matchAll(LINE)) if (!seen.includes(m[1])) seen.push(m[1])
  return seen
}

/**
 * Troca cada rótulo pelo nome dado: { "Outros 1": "Ana", "Outros 2": "Bruno" }.
 * Nas falas da transcrição sempre; os rótulos numerados também no resto da nota (o resumo cita "Outros 2").
 */
export function renameSpeakers(markdown: string, names: Record<string, string>): string {
  let out = markdown
  for (const [label, name] of Object.entries(names)) {
    const clean = cleanName(name)
    if (!clean || !OTHERS.some((o) => label === o || new RegExp(`^${escapeRe(o)} \\d{1,2}$`).test(label))) continue
    const l = escapeRe(label)
    out = out.replace(new RegExp(`(\\*\\*\\d{1,2}:\\d{2}(?::\\d{2})? · )${l}(:\\*\\*)`, 'g'), `$1${clean}$2`)
    if (/\d$/.test(label)) out = out.replace(new RegExp(`(?<![\\p{L}\\d])${l}(?![\\p{L}\\d])`, 'gu'), clean)
  }
  return out
}

/** Troca "Outros" pelo nome da pessoa nas falas da transcrição. O resto do texto não muda. */
export function renameOthers(markdown: string, name: string): string {
  return renameSpeakers(markdown, Object.fromEntries(OTHERS.map((o) => [o, name])))
}

/** A nota ainda tem falas com o rótulo "Outros" (com ou sem número)? */
export function hasOthers(markdown: string): boolean {
  return othersLabels(markdown).length > 0
}
