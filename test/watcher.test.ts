import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { NotesWatcher, rememberOwnWrite } from '../src/main/watcher'

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

describe('observador da pasta de notas', () => {
  it('avisa edição de fora e ignora a gravação do próprio app', async () => {
    const root = mkdtempSync(join(tmpdir(), 'tfb-watch-'))
    mkdirSync(join(root, 'Notas'))
    writeFileSync(join(root, 'Notas', 'a.md'), '# A\n')
    rememberOwnWrite('Notas/a.md', '# A\n')
    const changed: string[] = []
    let trees = 0
    const w = new NotesWatcher(
      () => trees++,
      (rel) => changed.push(rel)
    )
    w.start(root)
    await wait(100)

    rememberOwnWrite('Notas/a.md', '# A\n\neditado no app\n')
    writeFileSync(join(root, 'Notas', 'a.md'), '# A\n\neditado no app\n')
    await wait(700)
    expect(changed).toEqual([])

    writeFileSync(join(root, 'Notas', 'a.md'), '# A\n\neditado no Obsidian\n')
    await wait(700)
    expect(changed).toEqual(['Notas/a.md'])
    expect(trees).toBe(0)

    writeFileSync(join(root, 'Notas', 'b.md'), '# B\n')
    await wait(700)
    expect(trees).toBe(1)
    w.stop()
  })
})
