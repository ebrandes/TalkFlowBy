/** Rótulo "Outros" das notas, nos idiomas do app. */
const OTHERS = ['Outros', 'Others']

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Troca "Outros" pelo nome da pessoa nas falas da transcrição ("**00:12 · Outros:**").
 * O resto do texto não muda.
 */
export function renameOthers(markdown: string, name: string): string {
  const clean = name.replace(/[*_`[\]\\]/g, '').trim()
  if (!clean) return markdown
  const labels = OTHERS.map(escapeRe).join('|')
  return markdown.replace(new RegExp(`(\\*\\*\\d{1,2}:\\d{2}(?::\\d{2})? · )(?:${labels})(:\\*\\*)`, 'g'), `$1${clean}$2`)
}

/** A nota ainda tem falas com o rótulo "Outros"? */
export function hasOthers(markdown: string): boolean {
  return renameOthers(markdown, '\u0000x') !== markdown
}
