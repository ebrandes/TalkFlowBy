import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { lint } from 'markdownlint/sync'
import { afterEach, describe, expect, it } from 'vitest'
import { pt } from '../src/shared/i18n/pt'
import { buildMeetingMarkdown } from '../src/main/pipeline/markdown'
import { encodeLink, pickForSummary, placeShots, plainTextWithShots, readShots, shotLabel } from '../src/main/pipeline/shots'
import { parseStreamResult } from '../src/main/pipeline/summarize'
import { RecordingStore } from '../src/main/recording'
import type { Turn } from '../src/shared/types'

const meta = { startedAt: new Date(2026, 10, 18, 10, 0), durationSec: 600, origin: 'Microsoft Teams' }
const turns: Turn[] = [
  { speaker: 'Outros', start: 0, text: 'Bom dia.' },
  { speaker: 'Você', start: 60, text: 'Vou mostrar a planilha.' },
  { speaker: 'Outros', start: 120, text: 'O número de novembro subiu.' }
]

describe('capturas de tela na nota', () => {
  it('entram na transcrição no momento em que foram feitas', () => {
    const shots = [
      { link: encodeLink('nota - telas/tela-01.jpg'), offsetSec: 70, label: shotLabel('Tela', 1, 70) },
      { link: encodeLink('nota - telas/tela-02.jpg'), offsetSec: 500, label: shotLabel('Tela', 2, 500) }
    ]
    const md = buildMeetingMarkdown(meta, null, turns, pt.doc, undefined, shots)
    const planilha = md.indexOf('Vou mostrar a planilha')
    const tela1 = md.indexOf('![Tela 1 · 01:10](nota%20-%20telas/tela-01.jpg)')
    const novembro = md.indexOf('O número de novembro')
    expect(planilha).toBeLessThan(tela1)
    expect(tela1).toBeLessThan(novembro)
    expect(md.trimEnd().endsWith('![Tela 2 · 08:20](nota%20-%20telas/tela-02.jpg)')).toBe(true)
    expect(lint({ strings: { md } }).md).toEqual([])
  })

  it('aparecem mesmo sem fala reconhecida', () => {
    const md = buildMeetingMarkdown(meta, null, [], pt.doc, undefined, [{ link: 'a.jpg', offsetSec: 5, label: 'Tela 1 · 00:05' }])
    expect(md).toContain(pt.doc.noSpeech)
    expect(md).toContain('![Tela 1 · 00:05](a.jpg)')
    expect(lint({ strings: { md } }).md).toEqual([])
  })

  it('codifica espaço e parênteses no link', () => {
    expect(encodeLink('Reunião (Q4) - telas/tela-01.jpg')).toBe('Reuni%C3%A3o%20%28Q4%29%20-%20telas/tela-01.jpg')
  })
})

describe('capturas no resumo', () => {
  it('marca cada tela no texto da transcrição', () => {
    const text = plainTextWithShots(turns, { Você: 'Você', Outros: 'Outros' }, [{ label: 'Tela 1 · 01:10', offsetSec: 70 }])
    expect(text.split('\n')).toEqual(['[00:00] Outros: Bom dia.', '[01:00] Você: Vou mostrar a planilha.', '[Tela 1 · 01:10]', '[02:00] Outros: O número de novembro subiu.'])
  })

  it('com muitas telas, escolhe espalhadas, sempre com a primeira e a última', () => {
    const many = Array.from({ length: 40 }, (_, i) => i)
    const picked = pickForSummary(many, 12)
    expect(picked).toHaveLength(12)
    expect(picked[0]).toBe(0)
    expect(picked[11]).toBe(39)
    expect(pickForSummary([1, 2, 3], 12)).toEqual([1, 2, 3])
  })

  it('lê o resultado da saída em linhas do Claude Code', () => {
    const out = [
      '{"type":"system","subtype":"init"}',
      '{"type":"assistant","message":{}}',
      JSON.stringify({ type: 'result', is_error: false, structured_output: { assunto: 'Planilha de novembro', resumo: 'x', topicos: [], decisoes: [], tarefas: [] } })
    ].join('\r\n')
    expect(parseStreamResult(out).assunto).toBe('Planilha de novembro')
    expect(() => parseStreamResult('{"type":"system"}')).toThrow()
    expect(() => parseStreamResult(JSON.stringify({ type: 'result', is_error: true, result: 'quota' }))).toThrow(/quota/)
  })
})

describe('capturas guardadas e copiadas', () => {
  let dir = ''
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  it('a gravação guarda as capturas e o processamento copia para perto da nota', async () => {
    dir = await mkdtemp(join(tmpdir(), 'tfb-shots-'))
    const store = new RecordingStore(() => dir)
    const s = await store.begin('Teams')
    expect(await store.addShot(Buffer.from('full-1'), Buffer.from('small-1'), 70)).toBe(1)
    expect(await store.addShot(Buffer.from('full-2'), Buffer.from('small-2'), 500)).toBe(2)
    await store.finish()

    const shots = await readShots(s.dir)
    expect(shots.map((x) => x.offsetSec)).toEqual([70, 500])
    const notes = join(dir, 'Meetings')
    await mkdir(notes, { recursive: true })
    const note = join(notes, '2026-11-18 10h00 - Planilha (Q4).md')
    await writeFile(note, '')
    const placed = await placeShots(shots, s.dir, note, 'telas', 'tela')
    expect(placed.map((p) => p.link)).toEqual(['2026-11-18%2010h00%20-%20Planilha%20%28Q4%29%20-%20telas/tela-01.jpg', '2026-11-18%2010h00%20-%20Planilha%20%28Q4%29%20-%20telas/tela-02.jpg'])
    const copied = join(notes, '2026-11-18 10h00 - Planilha (Q4) - telas', 'tela-02.jpg')
    expect(existsSync(copied)).toBe(true)
    expect(await readFile(copied, 'utf8')).toBe('full-2')
  })

  it('sem capturas, nada muda', async () => {
    dir = await mkdtemp(join(tmpdir(), 'tfb-shots-'))
    expect(await readShots(dir)).toEqual([])
    expect(await placeShots([], dir, join(dir, 'n.md'), 'telas', 'tela')).toEqual([])
  })
})
