import type { Dict } from '../../../shared/i18n'
import type { Folders, LibraryNode } from '../../../shared/types'

export interface MeetingName {
  year: number
  month: number
  day: number
  time: string
  subject: string
  prefix: string
}

/** "2026-11-17 14h30 - Assunto" ou "2026-11-17 14.30 - Subject" → partes. Null fora do padrão. */
export function parseMeetingName(name: string): MeetingName | null {
  const m = name.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2})([h.])(\d{2}) - (.+)$/)
  if (!m) return null
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    time: `${m[4]}:${m[6]}`,
    subject: m[7],
    prefix: `${m[1]}-${m[2]}-${m[3]} ${m[4]}${m[5]}${m[6]}`
  }
}

export interface ListItem {
  path: string
  title: string
  meeting: MeetingName | null
  modifiedAt?: number
}

export interface Group {
  label: string
  items: ListItem[]
}

function files(nodes: LibraryNode[]): LibraryNode[] {
  return nodes.flatMap((n) => (n.kind === 'file' ? [n] : files(n.children ?? [])))
}

const findFolder = (tree: LibraryNode[], name: string): LibraryNode[] =>
  tree.find((n) => n.kind === 'folder' && n.name === name)?.children ?? []

/** Reuniões agrupadas por mês, mais recentes primeiro. */
export function meetingGroups(tree: LibraryNode[], query: string, folders: Folders, t: Dict): Group[] {
  const q = query.trim().toLowerCase()
  const items = files(findFolder(tree, folders.meetings))
    .map((f) => {
      const meeting = parseMeetingName(f.name)
      return { path: f.path, title: meeting?.subject ?? f.name, meeting, modifiedAt: f.modifiedAt }
    })
    .filter((i) => !q || i.title.toLowerCase().includes(q))
    .sort((a, b) => b.path.localeCompare(a.path, 'pt-BR', { numeric: true }))

  const groups: Group[] = []
  for (const item of items) {
    const label = item.meeting ? `${t.monthsLong[item.meeting.month - 1]} ${item.meeting.year}` : '—'
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(item)
    else groups.push({ label, items: [item] })
  }
  return groups
}

export function noteItems(tree: LibraryNode[], query: string, folders: Folders): ListItem[] {
  const q = query.trim().toLowerCase()
  return files(findFolder(tree, folders.notes))
    .map((f) => ({ path: f.path, title: f.name, meeting: null, modifiedAt: f.modifiedAt }))
    .filter((i) => !q || i.title.toLowerCase().includes(q))
    .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
}

/** Intervalo de datas das reuniões listadas, como as palavras-guia de um dicionário. */
export function guideSpan(groups: Group[], months: string[]): [string, string] | null {
  const dated = groups.flatMap((g) => g.items).filter((i) => i.meeting)
  if (dated.length === 0) return null
  const fmt = (m: MeetingName): string => `${m.day} ${months[m.month - 1]} ${m.year}`
  return [fmt(dated[dated.length - 1].meeting!), fmt(dated[0].meeting!)]
}

export interface Frontmatter {
  data?: string
  duracao?: string
  origem?: string
}

/** Separa o cabeçalho YAML do corpo; o editor só mexe no corpo. */
export function splitFrontmatter(md: string): { front: string; meta: Frontmatter; body: string } {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!m) return { front: '', meta: {}, body: md }
  const meta: Frontmatter = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w+):\s*(.*)$/)
    if (!kv) continue
    let value = kv[2].trim()
    if (value.startsWith('"')) {
      try {
        value = JSON.parse(value)
      } catch {
        /* mantém como veio */
      }
    }
    // Aceita as chaves em português e em inglês.
    const key = ({ data: 'data', date: 'data', duracao: 'duracao', duration: 'duracao', origem: 'origem', source: 'origem' } as const)[
      kv[1] as 'data'
    ]
    if (key) meta[key] = value
  }
  return { front: m[0], meta, body: md.slice(m[0].length).replace(/^\r?\n/, '') }
}

export function joinFrontmatter(front: string, body: string): string {
  if (!front) return body
  return `${front.endsWith('\n') ? front : `${front}\n`}\n${body.replace(/^\n+/, '')}`
}

/** Primeira citação do corpo: é o resumo curto da reunião. */
export function summaryPreview(body: string): string {
  const line = body.split('\n').find((l) => l.startsWith('> '))
  return line ? line.slice(2).replace(/\\(.)/g, '$1').trim() : ''
}
