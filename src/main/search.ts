import { readdir, readFile, stat } from 'node:fs/promises'
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

/** Texto da nota pronto para busca: sem cabeçalho nem marcação, numa linha, e a versão sem acento. */
export interface Prepared {
  plain: string
  folded: string
}

export function prepare(text: string): Prepared {
  const plain = text
    .replace(/^---[\s\S]*?---\s*/, '')
    .replace(/[#>*_`\\[\]]/g, '')
    .replace(/\s+/g, ' ')
  return { plain, folded: fold(plain) }
}

function snippetIn(p: Prepared, foldedQuery: string): string | null {
  const at = p.folded.indexOf(foldedQuery)
  if (at < 0) return null
  const start = Math.max(0, at - CONTEXT)
  const end = Math.min(p.plain.length, at + foldedQuery.length + CONTEXT)
  return `${start > 0 ? '…' : ''}${p.plain.slice(start, end).trim()}${end < p.plain.length ? '…' : ''}`
}

/** Trecho em volta da primeira ocorrência, numa linha só, sem marcação de markdown. */
export function snippetAround(text: string, query: string): string | null {
  return snippetIn(prepare(text), fold(query))
}

async function mdFiles(dir: string): Promise<string[]> {
  const out: string[] = []
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  const nested = await Promise.all(
    entries
      .filter((e) => !e.name.startsWith('.'))
      .map(async (e) => {
        const full = join(dir, e.name)
        if (e.isDirectory()) return mdFiles(full)
        return e.name.toLowerCase().endsWith('.md') ? [full] : []
      })
  )
  for (const n of nested) out.push(...n)
  return out.sort()
}

/**
 * Notas já lidas, pela data de modificação: a busca só relê o que mudou desde a última vez,
 * em vez de abrir todos os arquivos a cada tecla.
 */
const cache = new Map<string, { mtimeMs: number; size: number; prepared: Prepared }>()

async function preparedNote(file: string): Promise<Prepared | null> {
  try {
    const st = await stat(file)
    const hit = cache.get(file)
    if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) return hit.prepared
    const prepared = prepare(await readFile(file, 'utf8'))
    cache.set(file, { mtimeMs: st.mtimeMs, size: st.size, prepared })
    return prepared
  } catch {
    cache.delete(file)
    return null
  }
}

/** Procura o texto dentro de todas as notas da pasta (reuniões e notas soltas). */
export async function searchNotes(root: string, query: string): Promise<SearchHit[]> {
  const q = fold(query.trim())
  if (q.length < 2) return []
  const files = await mdFiles(root)
  const notes: (Prepared | null)[] = []
  // Em grupos, para não abrir milhares de arquivos ao mesmo tempo.
  for (let i = 0; i < files.length; i += 32) notes.push(...(await Promise.all(files.slice(i, i + 32).map(preparedNote))))
  const hits: SearchHit[] = []
  for (const [i, note] of notes.entries()) {
    const snippet = note && snippetIn(note, q)
    if (snippet) hits.push({ path: relative(root, files[i]).split(sep).join('/'), snippet })
    if (hits.length >= MAX_HITS) break
  }
  return hits
}
