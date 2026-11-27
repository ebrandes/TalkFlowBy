import type { Dict } from '../shared/i18n'

/** Troca o erro técnico (ffmpeg, Whisper, Claude) por uma frase que diz o que fazer. */
export function friendlyError(err: unknown, t: Dict['errors']): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/took too long|cancelled/i.test(msg)) return t.summaryTimeout
  if (/No API key saved|Claude Code was not found/i.test(msg)) return t.noProvider
  if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed|network|Connection error/i.test(msg)) return t.offline
  if (/whisper/i.test(msg)) return t.whisper
  if (/ffmpeg/i.test(msg)) return t.ffmpeg
  if (/claude|anthropic|summary|API/i.test(msg)) return t.claude
  return t.generic(msg.length > 160 ? `${msg.slice(0, 160)}…` : msg)
}
