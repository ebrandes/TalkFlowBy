import { shell } from 'electron'
import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import type { LibraryNode } from '../shared/types'
import { safeName, uniqueName } from './pipeline/filename'

export const MEETINGS = 'Reuniões'
export const NOTES = 'Notas'

const toPosix = (p: string): string => p.split(sep).join('/')

/** Garante que o caminho pedido pela janela fica dentro da pasta do app. */
export function resolveInside(root: string, rel: string): string {
  const full = resolve(root, rel)
  const back = relative(root, full)
  if (back.startsWith('..') || resolve(back) === back) throw new Error('Caminho fora da pasta do TalkFlowBy.')
  return full
}

export async function ensureRoot(root: string): Promise<void> {
  await mkdir(join(root, MEETINGS), { recursive: true })
  await mkdir(join(root, NOTES), { recursive: true })
}

async function walk(root: string, dir: string): Promise<LibraryNode[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const nodes: LibraryNode[] = []
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    const full = join(dir, e.name)
    const path = toPosix(relative(root, full))
    if (e.isDirectory()) nodes.push({ kind: 'folder', name: e.name, path, children: await walk(root, full) })
    else if (e.name.toLowerCase().endsWith('.md')) {
      nodes.push({ kind: 'file', name: e.name.replace(/\.md$/i, ''), path, modifiedAt: (await stat(full)).mtimeMs })
    }
  }
  // Pastas de data e reuniões: mais recentes primeiro. Notas: ordem alfabética.
  const inMeetings = toPosix(relative(root, dir)).startsWith(MEETINGS)
  return nodes.sort((a, b) =>
    inMeetings ? b.name.localeCompare(a.name, 'pt-BR', { numeric: true }) : a.name.localeCompare(b.name, 'pt-BR')
  )
}

export async function listTree(root: string): Promise<LibraryNode[]> {
  await ensureRoot(root)
  return walk(root, root)
}

export async function readNote(root: string, rel: string): Promise<string> {
  return readFile(resolveInside(root, rel), 'utf8')
}

export async function writeNote(root: string, rel: string, content: string): Promise<void> {
  const full = resolveInside(root, rel)
  await mkdir(dirname(full), { recursive: true })
  await writeFile(full, content, 'utf8')
}

export async function createNote(root: string, title = 'Nova nota'): Promise<string> {
  const rel = uniqueName(`${NOTES}/${safeName(title)}.md`, (p) => existsSync(join(root, p)))
  await writeNote(root, rel, `# ${title}\n\n`)
  return rel
}

/** Renomeia mantendo a pasta; devolve o novo caminho relativo. */
export async function renameNote(root: string, rel: string, newTitle: string): Promise<string> {
  const from = resolveInside(root, rel)
  const folder = toPosix(dirname(rel))
  const target = uniqueName(`${folder}/${safeName(newTitle)}.md`, (p) => p !== rel && existsSync(join(root, p)))
  if (target === rel) return rel
  await rename(from, resolveInside(root, target))
  return target
}

/** Vai para a Lixeira do sistema, nunca apaga de vez. */
export async function trashNote(root: string, rel: string): Promise<void> {
  await shell.trashItem(resolveInside(root, rel))
}

export function revealNote(root: string, rel: string): void {
  shell.showItemInFolder(resolveInside(root, rel))
}
