import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildAskPrompt, citedIds, compactNote, loadNotes, packNotes, withoutTranscript } from '../src/main/ask'
import { parseBlocks, parseInline, toMarkdown } from '../src/renderer/src/lib/answer'

const meeting = (subject: string, transcript: string): string =>
  `---\ndata: 2026-11-17\n---\n\n# ${subject}\n\n## Resumo\n\nFalamos de ${subject}.\n\n![captura](shots/a.jpg)\n\n## Transcrição\n\n${transcript}\n\n## Fluxo\n\npassos`

describe('pesquisa inteligente: montagem do pedido', () => {
  it('tira imagens e pode tirar só a transcrição', () => {
    const md = meeting('deploy', 'eu disse que o repositório talkflowby vai mudar')
    expect(compactNote(md)).not.toContain('![captura]')
    const short = withoutTranscript(compactNote(md))
    expect(short).not.toContain('repositório talkflowby')
    expect(short).toContain('## Resumo')
    expect(short).toContain('## Fluxo')
    expect(withoutTranscript('# A\n\n## Transcript\n\nhello')).toBe('# A')
  })

  it('cabe no limite: inteiras primeiro, depois sem transcrição, depois de fora', () => {
    const big = 'x'.repeat(500)
    const notes = [
      { path: 'a.md', text: meeting('a', big) },
      { path: 'b.md', text: meeting('b', big) },
      { path: 'c.md', text: meeting('c', big) }
    ]
    const full = compactNote(notes[0].text).length
    const short = withoutTranscript(compactNote(notes[1].text)).length
    const r = packNotes(notes, full + short + 10)
    expect(r.included.map((n) => n.path)).toEqual(['a.md', 'b.md'])
    expect(r.trimmed).toBe(1)
    expect(r.omitted).toBe(1)
  })

  it('numera as notas e lê as citações', () => {
    const prompt = buildAskPrompt('  quais repositórios? ', [{ path: 'R/a "x".md', text: 'oi' }])
    expect(prompt).toContain(`<note id="1" path="R/a 'x'.md">`)
    expect(prompt.endsWith('Question: quais repositórios?')).toBe(true)
    expect(citedIds('foo [2][1] bar [2] e [9] e [0]', 3)).toEqual([2, 1])
  })

  it('lê uma nota ou todas, das mais novas para as mais antigas', async () => {
    const root = mkdtempSync(join(tmpdir(), 'tfb-ask-'))
    mkdirSync(join(root, 'Reuniões'), { recursive: true })
    writeFileSync(join(root, 'Reuniões', 'velha.md'), 'velha')
    writeFileSync(join(root, 'Reuniões', 'nova.md'), 'nova')
    writeFileSync(join(root, 'vazia.md'), '  ')
    utimesSync(join(root, 'Reuniões', 'velha.md'), new Date(2020, 0, 1), new Date(2020, 0, 1))
    expect((await loadNotes(root, null)).map((n) => n.path)).toEqual(['Reuniões/nova.md', 'Reuniões/velha.md'])
    expect(await loadNotes(root, 'Reuniões/velha.md')).toEqual([{ path: 'Reuniões/velha.md', text: 'velha' }])
    await expect(loadNotes(root, '../fora.md')).rejects.toThrow()
  })
})

describe('pesquisa inteligente: resposta', () => {
  it('separa títulos, listas, parágrafos e código', () => {
    const blocks = parseBlocks('Foram três:\n\n- `talkflowby` [1]\n- api\n  continua\n1. um\n\n## Fim\n```\ncode\n```')
    expect(blocks).toEqual([
      { kind: 'paragraph', text: 'Foram três:' },
      { kind: 'list', ordered: false, items: ['`talkflowby` [1]', 'api continua'] },
      { kind: 'list', ordered: true, items: ['um'] },
      { kind: 'heading', text: 'Fim' },
      { kind: 'code', text: 'code' }
    ])
  })

  it('marca negrito, código, link e citação sem HTML', () => {
    expect(parseInline('**a** `b` [3] [site](https://x.dev) *c* <img>')).toEqual([
      { kind: 'strong', text: 'a' },
      { kind: 'text', text: ' ' },
      { kind: 'code', text: 'b' },
      { kind: 'text', text: ' ' },
      { kind: 'cite', id: 3 },
      { kind: 'text', text: ' ' },
      { kind: 'link', text: 'site', href: 'https://x.dev' },
      { kind: 'text', text: ' ' },
      { kind: 'em', text: 'c' },
      { kind: 'text', text: ' <img>' }
    ])
  })

  it('copia em Markdown com o nome das notas no lugar dos números', () => {
    const md = toMarkdown({ answer: '- repo [1][2]', notes: ['R/2026-11-17 16h05 - Deploy.md', 'N/Ideias.md'], sources: [], omitted: 0, trimmed: 0 })
    expect(md).toBe('- repo [2026-11-17 16h05 - Deploy] [Ideias]')
  })
})
