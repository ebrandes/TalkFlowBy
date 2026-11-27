import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ shell: { trashItem: vi.fn(async (p: string) => (await import('node:fs/promises')).rm(p)), showItemInFolder: vi.fn() } }))

const { hasOthers, renameOthers } = await import('../src/shared/speakers')
const { listOpenTasks, openTasksIn, setTaskDone } = await import('../src/main/tasks')
const { trashNotes, undoTrash } = await import('../src/main/library')
const { shortcutLabel, SHORTCUTS } = await import('../src/shared/shortcuts')

describe('dar nome a "Outros"', () => {
  it('troca só o rótulo das falas', () => {
    const md = '**00:12 · Outros:** Os outros times\n\n**1:02:03 · Você:** ok\n\n**1:02:09 · Others:** fine'
    const out = renameOthers(md, 'Ana')
    expect(out).toBe('**00:12 · Ana:** Os outros times\n\n**1:02:03 · Você:** ok\n\n**1:02:09 · Ana:** fine')
    expect(hasOthers(md)).toBe(true)
    expect(hasOthers(out)).toBe(false)
    expect(renameOthers(md, '**')).toBe(md)
  })
})

describe('pendências', () => {
  it('acha os itens abertos e marca no arquivo', async () => {
    expect(openTasksIn('- [ ] a\n- [x] b\n  * [ ] c — Ana\ntexto [ ] d')).toEqual([
      { line: 0, text: 'a' },
      { line: 2, text: 'c — Ana' }
    ])
    const root = mkdtempSync(join(tmpdir(), 'tfb-tasks-'))
    mkdirSync(join(root, 'Reuniões'))
    writeFileSync(join(root, 'Reuniões', 'r.md'), '# R\n\n## Próximos passos\n\n- [ ] Avisar o time — Ana\n- [ ] Revisar\n')
    const tasks = await listOpenTasks(root)
    expect(tasks.map((t) => t.text)).toEqual(['Avisar o time — Ana', 'Revisar'])
    expect(await setTaskDone(root, tasks[0], true)).toBe(true)
    expect(readFileSync(join(root, 'Reuniões', 'r.md'), 'utf8')).toContain('- [x] Avisar o time — Ana')
    // A linha mudou desde a lista: não mexe.
    expect(await setTaskDone(root, { ...tasks[1], text: 'outra coisa' }, true)).toBe(false)
  })
})

describe('desfazer a ida para a Lixeira', () => {
  it('põe a nota e o diagrama de volta', async () => {
    const root = mkdtempSync(join(tmpdir(), 'tfb-undo-'))
    mkdirSync(join(root, 'Notas'))
    writeFileSync(join(root, 'Notas', 'a.md'), '# A\n')
    writeFileSync(join(root, 'Notas', 'a - fluxo.svg'), '<svg/>')
    const { count, undoId } = await trashNotes(root, ['Notas/a.md'])
    expect(count).toBe(1)
    expect(await undoTrash(undoId!)).toEqual(['Notas/a.md'])
    expect(readFileSync(join(root, 'Notas', 'a - fluxo.svg'), 'utf8')).toBe('<svg/>')
    expect(await undoTrash(undoId!)).toEqual([])
  })
})

describe('atalhos', () => {
  it('mostra no jeito de cada sistema', () => {
    expect(shortcutLabel(SHORTCUTS.record, 'win32')).toBe('Ctrl+Alt+R')
    expect(shortcutLabel(SHORTCUTS.record, 'darwin')).toBe('⌘⌥R')
  })
})
