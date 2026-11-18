/** Só a seção de transcrição de uma nota de reunião (português ou inglês). */
export function transcriptOf(body: string): string {
  const lines = body.split('\n')
  const start = lines.findIndex((l) => /^## (Transcrição|Transcript)\s*$/.test(l))
  if (start < 0) return ''
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((l) => /^## /.test(l))
  return (end < 0 ? rest : rest.slice(0, end)).join('\n').trim()
}

/** Abaixo disso o texto vai junto no link; acima, só pela área de transferência. */
const MAX_URL_TEXT = 6000

/** Abre uma conversa nova no Claude, já com a nota quando ela cabe no endereço. */
export function claudeUrl(text: string): string {
  if (text.length > MAX_URL_TEXT) return 'https://claude.ai/new'
  return `https://claude.ai/new?q=${encodeURIComponent(text)}`
}
