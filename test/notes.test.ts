import { describe, expect, it } from 'vitest'
import type { LibraryNode } from '../src/shared/types'
import {
  guideSpan,
  joinFrontmatter,
  meetingGroups,
  noteItems,
  parseMeetingName,
  splitFrontmatter,
  summaryPreview
} from '../src/renderer/src/lib/notes'
import { pt } from '../src/shared/i18n/pt'

const F = { meetings: 'Reuniões', notes: 'Notas' }

const tree: LibraryNode[] = [
  {
    kind: 'folder', name: 'Reuniões', path: 'Reuniões', children: [
      { kind: 'folder', name: '2026', path: 'Reuniões/2026', children: [
        { kind: 'folder', name: '11', path: 'Reuniões/2026/11', children: [
          { kind: 'file', name: '2026-11-17 14h30 - Planejamento', path: 'Reuniões/2026/11/2026-11-17 14h30 - Planejamento.md' },
          { kind: 'file', name: '2026-11-03 15h00 - Cliente piloto', path: 'Reuniões/2026/11/2026-11-03 15h00 - Cliente piloto.md' }
        ] },
        { kind: 'folder', name: '10', path: 'Reuniões/2026/10', children: [
          { kind: 'file', name: '2026-10-28 09h00 - Sprint', path: 'Reuniões/2026/10/2026-10-28 09h00 - Sprint.md' }
        ] }
      ] }
    ]
  },
  { kind: 'folder', name: 'Notas', path: 'Notas', children: [
    { kind: 'file', name: 'Zebra', path: 'Notas/Zebra.md' },
    { kind: 'file', name: 'Abacate', path: 'Notas/Abacate.md' }
  ] }
]

describe('lista', () => {
  it('agrupa reuniões por mês, recentes primeiro', () => {
    const groups = meetingGroups(tree, '', F, pt)
    expect(groups.map((g) => g.label)).toEqual(['Novembro 2026', 'Outubro 2026'])
    expect(groups[0].items.map((i) => i.title)).toEqual(['Planejamento', 'Cliente piloto'])
    expect(guideSpan(groups, pt.months)).toEqual(['28 out 2026', '17 nov 2026'])
  })

  it('filtra pela busca e ordena notas', () => {
    expect(meetingGroups(tree, 'sprint', F, pt).flatMap((g) => g.items).map((i) => i.title)).toEqual(['Sprint'])
    expect(noteItems(tree, '', F).map((i) => i.title)).toEqual(['Abacate', 'Zebra'])
  })

  it('lê o nome da reunião', () => {
    expect(parseMeetingName('2026-11-17 14h30 - A - B')).toMatchObject({ day: 17, time: '14:30', subject: 'A - B' })
    expect(parseMeetingName('2026-11-17 14.30 - Launch plan')).toMatchObject({ time: '14:30', subject: 'Launch plan', prefix: '2026-11-17 14.30' })
    expect(parseMeetingName('Ideias')).toBeNull()
  })
})

describe('frontmatter', () => {
  const md = '---\ndata: 2026-11-17 14:30\nduracao: 42 min\norigem: "Google Meet (Chrome)"\n---\n\n# Título\n\n> Resumo \\*curto\\*.\n'

  it('separa e junta sem perder nada', () => {
    const { front, meta, body } = splitFrontmatter(md)
    expect(meta).toEqual({ data: '2026-11-17 14:30', duracao: '42 min', origem: 'Google Meet (Chrome)' })
    expect(body.startsWith('# Título')).toBe(true)
    expect(joinFrontmatter(front, body)).toBe(md)
    expect(summaryPreview(body)).toBe('Resumo *curto*.')
  })

  it('lê as chaves em inglês', () => {
    const { meta } = splitFrontmatter('---\ndate: 2026-11-17 14:30\nduration: 5 min\nsource: Zoom\n---\n\n# X\n')
    expect(meta).toEqual({ data: '2026-11-17 14:30', duracao: '5 min', origem: 'Zoom' })
  })

  it('nota sem frontmatter passa intacta', () => {
    expect(splitFrontmatter('# Oi\n').body).toBe('# Oi\n')
  })
})
