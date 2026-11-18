const pad = (n: number): string => String(n).padStart(2, '0')

const RESERVED_WIN = /^(con|prn|aux|nul|com\d|lpt\d)$/i

/** Nome seguro no Mac e no Windows: sem caracteres proibidos, sem ponto ou espaço no fim. */
export function safeName(raw: string, max = 80): string {
  let name = raw
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (name.length > max) name = name.slice(0, max).replace(/\s+\S*$/, '')
  name = name.replace(/[. ]+$/, '')
  if (!name || RESERVED_WIN.test(name)) name = 'Sem título'
  return name
}

/**
 * `Reuniões/2026/11/2026-11-17 14h30 - Assunto.md` (português) ou
 * `Meetings/2026/11/2026-11-17 14.30 - Subject.md` (inglês). Dois-pontos não vale no Windows.
 */
export function meetingRelPath(startedAt: Date, assunto: string, folder = 'Reuniões', timeSep = 'h'): string {
  const y = startedAt.getFullYear()
  const m = pad(startedAt.getMonth() + 1)
  const d = pad(startedAt.getDate())
  const time = `${pad(startedAt.getHours())}${timeSep}${pad(startedAt.getMinutes())}`
  return `${folder}/${y}/${m}/${y}-${m}-${d} ${time} - ${safeName(assunto)}.md`
}

/** Acrescenta ` (2)`, ` (3)`… até achar um nome livre. */
export function uniqueName(relPath: string, exists: (p: string) => boolean): string {
  if (!exists(relPath)) return relPath
  const dot = relPath.lastIndexOf('.')
  const base = dot > 0 ? relPath.slice(0, dot) : relPath
  const ext = dot > 0 ? relPath.slice(dot) : ''
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base} (${i})${ext}`
    if (!exists(candidate)) return candidate
  }
  return `${base} (${Date.now()})${ext}`
}
