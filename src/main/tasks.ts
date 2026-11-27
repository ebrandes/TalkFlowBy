import { readFile } from 'node:fs/promises'
import { relative, sep } from 'node:path'
import type { OpenTask } from '../shared/types'
import { readNote, writeNote } from './library'
import { mdFiles } from './search'

const TASK = /^(\s*[-*+] )\[( |x|X)\] (.+)$/

/** Itens "- [ ]" ainda abertos numa nota, com o número da linha para marcar depois. */
export function openTasksIn(markdown: string): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = []
  markdown.split(/\r?\n/).forEach((l, i) => {
    const m = TASK.exec(l)
    if (m && m[2] === ' ') out.push({ line: i, text: m[3].trim() })
  })
  return out
}

/** Todas as pendências das notas e reuniões, das mais novas para as mais antigas. */
export async function listOpenTasks(root: string): Promise<OpenTask[]> {
  const files = (await mdFiles(root)).sort().reverse()
  const out: OpenTask[] = []
  for (const file of files) {
    const md = await readFile(file, 'utf8').catch(() => '')
    const path = relative(root, file).split(sep).join('/')
    for (const t of openTasksIn(md)) out.push({ path, ...t })
  }
  return out
}

/** Marca (ou desmarca) uma pendência, conferindo que a linha ainda é a mesma. */
export async function setTaskDone(root: string, task: OpenTask, done: boolean): Promise<boolean> {
  const md = await readNote(root, task.path)
  const lines = md.split('\n')
  const line = lines[task.line]?.replace(/\r$/, '')
  const m = line !== undefined ? TASK.exec(line) : null
  if (!m || m[3].trim() !== task.text) return false
  lines[task.line] = lines[task.line].replace(/\[( |x|X)\]/, done ? '[x]' : '[ ]')
  await writeNote(root, task.path, lines.join('\n'))
  return true
}

