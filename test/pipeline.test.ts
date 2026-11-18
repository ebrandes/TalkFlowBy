import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { lint } from 'markdownlint/sync'
import { describe, expect, it } from 'vitest'
import type { Segment, Summary } from '../src/shared/types'
import { meetingRelPath, safeName, uniqueName } from '../src/main/pipeline/filename'
import { buildMeetingMarkdown, escapeInline, formatDuration } from '../src/main/pipeline/markdown'
import { collapseRepeats, formatClock, mergeTracks } from '../src/main/pipeline/merge'
import { extractJson, normalizeSummary } from '../src/main/pipeline/summary-schema'
import { parseWhisperJson } from '../src/main/pipeline/whisper'
import { en } from '../src/shared/i18n/en'
import { speechIntervals } from '../src/main/pipeline/chunks'

// Conteúdo sintético, só para teste.
const mic: Segment[] = [
  { speaker: 'Você', start: 0, end: 4, text: ' Vamos fechar dezembro com oito vídeos.' },
  { speaker: 'Você', start: 4.2, end: 7, text: 'Dois por semana.' },
  { speaker: 'Você', start: 70, end: 74, text: 'Testo a capa nova em dois vídeos.' }
]
const sys: Segment[] = [
  { speaker: 'Outros', start: 8, end: 12, text: 'A cota de voz acaba dia 20.' },
  { speaker: 'Outros', start: 12.5, end: 13, text: '[Música]' }
]

const summary: Summary = {
  assunto: 'Planejamento do canal em dezembro',
  resumo: 'O time fechou o calendário com oito vídeos. A capa nova entra em teste.',
  topicos: [
    { titulo: 'Calendário de dezembro', pontos: ['Oito vídeos, dois por semana.', 'Especial sai dia 23.'] },
    { titulo: 'Orçamento de vozes', pontos: ['Cota acaba dia 20.'] }
  ],
  decisoes: ['Capa nova em teste com dois vídeos.'],
  tarefas: [{ tarefa: 'Montar roteiro do especial', responsavel: 'Marina' }, { tarefa: 'Medir cota de voz' }]
}
const meta = { startedAt: new Date(2026, 10, 17, 14, 30), durationSec: 42 * 60, origin: 'Google Meet' }

describe('mergeTracks', () => {
  it('intercala pelo tempo, agrupa falas seguidas e descarta ruído', () => {
    const turns = mergeTracks(mic, sys)
    expect(turns.map((t) => [t.speaker, t.start])).toEqual([
      ['Você', 0],
      ['Outros', 8],
      ['Você', 70]
    ])
    expect(turns[0].text).toBe('Vamos fechar dezembro com oito vídeos. Dois por semana.')
  })

  it('formata relógio com e sem horas', () => {
    expect(formatClock(65)).toBe('01:05')
    expect(formatClock(3725)).toBe('1:02:05')
  })
})

describe('buildMeetingMarkdown', () => {
  const md = buildMeetingMarkdown(meta, summary, mergeTracks(mic, sys))

  it('bate com o arquivo de referência', () => {
    const expected = readFileSync(join(__dirname, 'fixtures', 'reuniao.md'), 'utf8')
    expect(md).toBe(expected)
  })

  it('passa no markdownlint (exceto tamanho de linha)', () => {
    const result = lint({ strings: { nota: md }, config: { default: true, MD013: false } })
    expect(result.nota).toEqual([])
  })

  it('sem resumo ainda gera nota legível', () => {
    const out = buildMeetingMarkdown(meta, null, mergeTracks(mic, sys))
    expect(out).toContain('# Reunião sem assunto')
    expect(out).toContain('O resumo não foi gerado')
    expect(lint({ strings: { n: out }, config: { default: true, MD013: false } }).n).toEqual([])
  })

  it('em inglês usa títulos, falantes e chaves em inglês', () => {
    const out = buildMeetingMarkdown(meta, summary, mergeTracks(mic, sys), en.doc)
    expect(out).toContain('date: 2026-11-17 14:30')
    expect(out).toContain('## Topics')
    expect(out).toContain('## Next steps')
    expect(out).toContain('**00:00 · You:**')
    expect(out).toContain('**00:08 · Others:**')
    expect(lint({ strings: { n: out }, config: { default: true, MD013: false } }).n).toEqual([])
  })

  it('omite seções vazias', () => {
    const out = buildMeetingMarkdown(meta, { ...summary, decisoes: [], tarefas: [] }, [])
    expect(out).not.toContain('## Decisões')
    expect(out).not.toContain('## Próximos passos')
    expect(out).toContain('Nenhuma fala foi reconhecida')
  })
})

describe('escapeInline', () => {
  it('protege marcações sem estragar texto comum', () => {
    expect(escapeInline('preço *promocional* [link]')).toBe('preço \\*promocional\\* \\[link\\]')
    expect(escapeInline('nome_de_arquivo fica igual')).toBe('nome_de_arquivo fica igual')
  })

  it('duração legível', () => {
    expect(formatDuration(42 * 60)).toBe('42 min')
    expect(formatDuration(95 * 60)).toBe('1 h 35 min')
  })
})

describe('nomes de arquivo', () => {
  it('em inglês usa a pasta Meetings e hora com ponto', () => {
    expect(meetingRelPath(meta.startedAt, 'Launch plan', 'Meetings', '.')).toBe('Meetings/2026/11/2026-11-17 14.30 - Launch plan.md')
  })

  it('monta pasta por ano e mês com hora e assunto', () => {
    expect(meetingRelPath(meta.startedAt, 'Planejamento: canal/dez?')).toBe(
      'Reuniões/2026/11/2026-11-17 14h30 - Planejamento canal dez.md'
    )
  })

  it('evita nomes proibidos e repetidos', () => {
    expect(safeName('CON')).toBe('Sem título')
    expect(safeName('fim com ponto...')).toBe('fim com ponto')
    const taken = new Set(['a.md', 'a (2).md'])
    expect(uniqueName('a.md', (p) => taken.has(p))).toBe('a (3).md')
  })
})

describe('resumo do modelo', () => {
  it('normaliza campos faltando e extrai JSON cercado', () => {
    const raw = extractJson('Aqui está:\n```json\n{"assunto":" X ","topicos":[{"titulo":"T"}],"tarefas":[{"tarefa":""}]}\n```')
    expect(normalizeSummary(raw)).toEqual({
      assunto: 'X',
      resumo: '',
      topicos: [{ titulo: 'T', pontos: [] }],
      decisoes: [],
      tarefas: [],
      fluxo: null
    })
  })
})

describe('parseWhisperJson', () => {
  it('converte milissegundos e ignora vazios', () => {
    const segs = parseWhisperJson(
      { transcription: [{ offsets: { from: 1500, to: 3000 }, text: ' Olá ' }, { offsets: { from: 3000, to: 3100 }, text: ' ' }] },
      'Outros'
    )
    expect(segs).toEqual([{ speaker: 'Outros', start: 1.5, end: 3, text: 'Olá' }])
  })
})

describe('speechIntervals', () => {
  it('acha os trechos com voz, junta pausas curtas e ignora estalos', () => {
    const log = [
      '[silencedetect @ 0x1] silence_start: 0',
      '[silencedetect @ 0x1] silence_end: 2.0 | silence_duration: 2.0',
      '[silencedetect @ 0x1] silence_start: 5.0',
      '[silencedetect @ 0x1] silence_end: 5.9 | silence_duration: 0.9',
      '[silencedetect @ 0x1] silence_start: 8.0',
      '[silencedetect @ 0x1] silence_end: 20.0 | silence_duration: 12',
      '[silencedetect @ 0x1] silence_start: 20.3'
    ].join('\n')
    expect(speechIntervals(log, 30)).toEqual([{ start: 1.75, end: 8.25 }])
  })

  it('soma o início do trecho aos horários do Whisper', () => {
    const segs = parseWhisperJson({ transcription: [{ offsets: { from: 500, to: 1500 }, text: 'Oi' }] }, 'Você', 10)
    expect(segs[0]).toMatchObject({ start: 10.5, end: 11.5 })
  })
})

describe('collapseRepeats', () => {
  it('corta laços do Whisper sem mexer em repetição normal', () => {
    expect(collapseRepeats('O que é que é que é que é que é a gente')).toBe('O que é a gente')
    expect(collapseRepeats('a gente que é a gente que é a gente que é')).toBe('a gente que é')
    expect(collapseRepeats('sim, sim, tudo certo')).toBe('sim, sim, tudo certo')
    expect(collapseRepeats('muito muito bom')).toBe('muito muito bom')
  })
})
