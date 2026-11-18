import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fold, searchNotes, snippetAround } from '../src/main/search'

describe('busca nas notas', () => {
  it('ignora acento e maiúscula e mostra o trecho', () => {
    expect(fold('Reunião ÁGIL')).toBe('reuniao agil')
    expect(snippetAround('---\ndata: x\n---\n\n# Título\n\nA migração do **pagamento** termina dia 28.', 'migracao')).toBe('Título A migração do pagamento termina dia 28.')
    expect(snippetAround('nada aqui', 'pagamento')).toBeNull()
  })

  it('acha dentro das notas e devolve caminho com barra', async () => {
    const root = mkdtempSync(join(tmpdir(), 'tfb-search-'))
    mkdirSync(join(root, 'Reuniões', '2026', '11'), { recursive: true })
    mkdirSync(join(root, '.audio'), { recursive: true })
    writeFileSync(join(root, 'Reuniões', '2026', '11', 'a.md'), '# A\n\nfalamos do orçamento de vozes')
    writeFileSync(join(root, 'Reuniões', '2026', '11', 'b.md'), '# B\n\noutra coisa')
    writeFileSync(join(root, '.audio', 'x.md'), 'orçamento escondido')
    const hits = await searchNotes(root, 'orcamento')
    expect(hits.map((h) => h.path)).toEqual(['Reuniões/2026/11/a.md'])
    expect(await searchNotes(root, 'o')).toEqual([])
  })
})
