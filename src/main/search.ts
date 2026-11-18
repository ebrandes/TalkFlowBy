import { readdir, readFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'

export interface SearchHit {
  path: string
  snippet: string
}

const MAX_HITS = 200
const CONTEXT = 60

/** Sem acento e em minúsculas: "Reunião" acha "reuniao". */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Trecho em volta da primeira ocorrência, numa linha só, sem marcação de markdown. */
export function snippetAround(text: string, query: string): string | null {
  const plain = text
    .replace(/^---[\s\S]*?---\s*/, '')
    .replace(/[#>*_`\\[\]]/g, '')
    .replace(/\s+/g, ' ')
  const at = fold(plain).indexOf(fold(query))
  if (at < 0) return null
  const start = Math.max(0, at - CONTEXT)
  const end = Math.min(plain.length, at + query.length + CONTEXT)
  return `${start > 0 ? '…' : ''}${plain.slice(start, end).trim()}${end < plain.length ? '…' : ''}`
}

async function mdFiles(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    if (e.name.startsWith('.')) continue
    const full = join(dir, e.name)
    if (e.isDirectory()) out.push(...(await mdFiles(full)))
    else if (e.name.toLowerCase().endsWith('.md')) out.push(full)
  }
  return out
}

/** Procura o texto dentro de todas as notas da pasta (reuniões e notas soltas). */
export async function searchNotes(root: string, query: string): Promise<SearchHit[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const hits: SearchHit[] = []
  for (const file of await mdFiles(root)) {
    const snippet = snippetAround(await readFile(file, 'utf8').catch(() => ''), q)
    if (snippet) hits.push({ path: relative(root, file).split(sep).join('/'), snippet })
    if (hits.length >= MAX_HITS) break
  }
  return hits
}
