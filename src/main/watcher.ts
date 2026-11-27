import { watch, type FSWatcher } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join, sep } from 'node:path'

/** O que o próprio app gravou por último em cada nota, para não confundir com edição de fora. */
const ownWrites = new Map<string, string>()

/** Chamado pela gravação de notas do app: a mudança que vem depois é nossa. */
export function rememberOwnWrite(rel: string, content: string): void {
  ownWrites.set(rel, content)
}

export function forgetOwnWrite(rel: string): void {
  ownWrites.delete(rel)
}

/** Pastas que começam com ponto (áudio, backups, sincronização) não contam. */
export function isNoteEvent(rel: string): boolean {
  const parts = rel.split(/[\\/]/)
  return rel.toLowerCase().endsWith('.md') && !parts.some((p) => p.startsWith('.'))
}

const toPosix = (p: string): string => p.split(sep).join('/')

/**
 * Observa a pasta das notas. Avisa quando a lista muda (arquivo novo, apagado, renomeado) e
 * quando uma nota foi editada fora do app (Obsidian, VS Code, sincronização).
 */
export class NotesWatcher {
  private watcher: FSWatcher | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private changed = new Set<string>()

  constructor(
    private onTreeChanged: () => void,
    private onNoteChanged: (rel: string) => void
  ) {}

  start(root: string): void {
    this.stop()
    try {
      this.watcher = watch(root, { recursive: true }, (_event, name) => {
        if (!name) return
        const rel = toPosix(name.toString())
        if (!isNoteEvent(rel)) return
        this.changed.add(rel)
        if (this.timer) clearTimeout(this.timer)
        this.timer = setTimeout(() => void this.flush(root), 300)
      })
      this.watcher.on('error', () => this.stop())
    } catch {
      // Sistema sem observação recursiva: a lista continua atualizando ao focar a janela.
      this.watcher = null
    }
  }

  private async flush(root: string): Promise<void> {
    const rels = [...this.changed]
    this.changed.clear()
    let tree = false
    for (const rel of rels) {
      let content: string | null
      try {
        content = await readFile(join(root, rel), 'utf8')
      } catch {
        content = null
      }
      if (content === null) {
        tree = true
        continue
      }
      if (ownWrites.get(rel) === content) continue
      if (!ownWrites.has(rel)) tree = true
      ownWrites.set(rel, content)
      this.onNoteChanged(rel)
    }
    if (tree) this.onTreeChanged()
  }

  stop(): void {
    this.watcher?.close()
    this.watcher = null
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }
}
