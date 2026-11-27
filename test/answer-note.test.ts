import { describe, expect, it } from 'vitest'
import { answerNoteBody, answerTitle, linkTitle, noteLink, relativeLink } from '../src/shared/answer-note'
import { noteFromLink } from '../src/renderer/src/lib/answer'

const meeting = 'Reuniões/2026/11/2026-11-27 09h12 - Recorte do orquestrador.md'

describe('resposta salva como nota', () => {
  it('liga a nota em Notas às reuniões com caminho relativo', () => {
    expect(relativeLink('Notas/Repos.md', meeting)).toBe('../Reuniões/2026/11/2026-11-27 09h12 - Recorte do orquestrador.md')
    expect(relativeLink('Notas/Repos.md', 'Notas/Outra.md')).toBe('Outra.md')
    expect(noteLink('Notas/Repos.md', meeting, 'x')).toBe('[x](../Reuni%C3%B5es/2026/11/2026-11-27%2009h12%20-%20Recorte%20do%20orquestrador.md)')
  })

  it('o link salvo abre a mesma nota de volta', () => {
    const href = /\]\((.+)\)$/.exec(noteLink('Notas/Repos.md', meeting, 'x'))![1]
    expect(noteFromLink('Notas/Repos.md', href)).toBe(meeting)
    expect(noteFromLink('Notas/Repos.md', 'https://github.com/x')).toBeNull()
    expect(noteFromLink('Notas/Repos.md', '../../fora.md')).toBeNull()
    expect(noteFromLink('Notas/Repos.md', 'imagem.png')).toBeNull()
  })

  it('título e corpo com as citações virando links e a lista de fontes', () => {
    expect(answerTitle('  liste os repositórios conversados nessa conversa? ')).toBe('Liste os repositórios conversados nessa conversa')
    expect(linkTitle(meeting)).toBe('Recorte do orquestrador (27/11/2026 09:12)')
    const body = answerNoteBody(
      'Notas/Repos.md',
      'Repos',
      { question: 'quais repos?', answer: '- **internal-dev-tools** [2][9]', notes: ['Notas/A.md', meeting], sources: [meeting] },
      { asked: 'Pergunta feita em 27/11.', sources: 'Fontes' }
    )
    expect(body).toContain('- **internal-dev-tools** [[2](../Reuni%C3%B5es/')
    expect(body).toContain('[9]')
    expect(body).toContain('## Fontes\n\n- (2) [Recorte do orquestrador (27/11/2026 09:12)](../Reuni%C3%B5es/')
    expect(body.startsWith('# Repos\n\n> quais repos?')).toBe(true)
  })
})
