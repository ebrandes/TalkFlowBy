import { shell } from 'electron'
import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import type { Folders, LibraryNode } from '../shared/types'
import { safeName, uniqueName } from './pipeline/filename'
import { forgetOwnWrite, rememberOwnWrite } from './watcher'

const toPosix = (p: string): string => p.split(sep).join('/')

/** Garante que o caminho pedido pela janela fica dentro da pasta do app. */
export function resolveInside(root: string, rel: string): string {
  const full = resolve(root, rel)
  const back = relative(root, full)
  if (back.startsWith('..') || resolve(back) === back) throw new Error('Path is outside the TalkFlowBy folder.')
  return full
}

export async function ensureRoot(root: string, folders: Folders): Promise<void> {
  await mkdir(join(root, folders.meetings), { recursive: true })
  await mkdir(join(root, folders.notes), { recursive: true })
}

async function walk(root: string, dir: string, meetings: string): Promise<LibraryNode[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const nodes: LibraryNode[] = []
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    const full = join(dir, e.name)
    const path = toPosix(relative(root, full))
    if (e.isDirectory()) nodes.push({ kind: 'folder', name: e.name, path, children: await walk(root, full, meetings) })
    else if (e.name.toLowerCase().endsWith('.md')) {
      nodes.push({ kind: 'file', name: e.name.replace(/\.md$/i, ''), path, modifiedAt: (await stat(full)).mtimeMs })
    }
  }
  // Pastas de data e reuniões: mais recentes primeiro. Notas: ordem alfabética.
  const inMeetings = toPosix(relative(root, dir)).startsWith(meetings)
  return nodes.sort((a, b) =>
    inMeetings ? b.name.localeCompare(a.name, 'pt-BR', { numeric: true }) : a.name.localeCompare(b.name, 'pt-BR')
  )
}

export async function listTree(root: string, folders: Folders): Promise<LibraryNode[]> {
  await ensureRoot(root, folders)
  return walk(root, root, folders.meetings)
}

export async function readNote(root: string, rel: string): Promise<string> {
  const content = await readFile(resolveInside(root, rel), 'utf8')
  rememberOwnWrite(rel, content)
  return content
}

export async function writeNote(root: string, rel: string, content: string): Promise<void> {
  const full = resolveInside(root, rel)
  await mkdir(dirname(full), { recursive: true })
  rememberOwnWrite(rel, content)
  await writeFile(full, content, 'utf8')
}

export async function createNote(root: string, notesFolder: string, title: string): Promise<string> {
  const rel = uniqueName(`${notesFolder}/${safeName(title)}.md`, (p) => existsSync(join(root, p)))
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
  forgetOwnWrite(rel)
  rememberOwnWrite(target, await readFile(resolveInside(root, target), 'utf8'))
  return target
}

/** Diagramas gerados para a nota ("<nota> - fluxo.svg"), que vão junto para a Lixeira. */
async function attachments(full: string): Promise<string[]> {
  const base = basename(full).replace(/\.md$/i, '')
  try {
    return (await readdir(dirname(full)))
      .filter((f) => f.startsWith(`${base} - `) && f.toLowerCase().endsWith('.svg'))
      .map((f) => join(dirname(full), f))
  } catch {
    return []
  }
}

/** Arquivos que acabaram de ir para a Lixeira, guardados por alguns minutos para o "Desfazer". */
const undoable = new Map<string, { files: { full: string; data: Buffer }[]; rels: string[] }>()
const UNDO_KEEP = 5

/** Vai para a Lixeira do sistema, nunca apaga de vez. Devolve o que foi, para poder desfazer. */
export async function trashNote(root: string, rel: string): Promise<{ full: string; data: Buffer }[]> {
  const full = resolveInside(root, rel)
  const files = [full, ...(await attachments(full))]
  const saved = await Promise.all(files.map(async (f) => ({ full: f, data: await readFile(f) })))
  for (const a of files.slice(1)) await shell.trashItem(a).catch(() => undefined)
  await shell.trashItem(full)
  forgetOwnWrite(rel)
  return saved
}

/** Várias de uma vez; devolve quantas foram para a Lixeira e a chave para desfazer. */
export async function trashNotes(root: string, rels: string[]): Promise<{ count: number; undoId: string | null }> {
  const files: { full: string; data: Buffer }[] = []
  const done: string[] = []
  for (const rel of rels) {
    try {
      files.push(...(await trashNote(root, rel)))
      done.push(rel)
    } catch {
      // Arquivo já sumiu ou está em uso: segue com os outros.
    }
  }
  if (done.length === 0) return { count: 0, undoId: null }
  const undoId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  undoable.set(undoId, { files, rels: done })
  while (undoable.size > UNDO_KEEP) undoable.delete(undoable.keys().next().value!)
  return { count: done.length, undoId }
}

/** Põe de volta o que foi para a Lixeira (a cópia na Lixeira do sistema continua lá). */
export async function undoTrash(undoId: string): Promise<string[]> {
  const entry = undoable.get(undoId)
  if (!entry) return []
  undoable.delete(undoId)
  for (const f of entry.files) {
    await mkdir(dirname(f.full), { recursive: true })
    if (!existsSync(f.full)) await writeFile(f.full, f.data)
  }
  return entry.rels
}

export function revealNote(root: string, rel: string): void {
  shell.showItemInFolder(resolveInside(root, rel))
}
