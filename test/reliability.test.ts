import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { en } from '../src/shared/i18n/en'
import { pt } from '../src/shared/i18n/pt'
import type { Segment, Summary } from '../src/shared/types'
import { friendlyError } from '../src/main/errors'
import { buildMeetingMarkdown } from '../src/main/pipeline/markdown'
import { dropEcho, mergeTracks } from '../src/main/pipeline/merge'
import { rebuildWithSummary, splitMeetingNote, transcriptForSummary } from '../src/main/pipeline/resummarize'
import { findFailed, markFailed, markProcessing, resetAttempts } from '../src/main/recovery'
import { isNoteEvent } from '../src/main/watcher'

const seg = (speaker: Segment['speaker'], start: number, text: string): Segment => ({ speaker, start, end: start + 4, text })

const summary: Summary = {
  assunto: 'Migração do pagamento',
  resumo: 'Decidimos migrar em dezembro.',
  topicos: [{ titulo: 'Prazo', pontos: ['Dezembro'] }],
  decisoes: ['Migrar em dezembro'],
  tarefas: [{ tarefa: 'Avisar o time', responsavel: 'Ana' }]
}

describe('erros claros', () => {
  it('diz o que fazer em vez do texto técnico', () => {
    expect(friendlyError(new Error('The summary took too long and was cancelled.'), pt.errors)).toBe(pt.errors.summaryTimeout)
    expect(friendlyError(new Error('Claude Code was not found on this computer. No API key saved.'), pt.errors)).toBe(pt.errors.noProvider)
    expect(friendlyError(new Error('fetch failed'), en.errors)).toBe(en.errors.offline)
    expect(friendlyError(new Error('Whisper falhou (1): oops'), pt.errors)).toBe(pt.errors.whisper)
    expect(friendlyError(new Error('ffmpeg falhou: x'), pt.errors)).toBe(pt.errors.ffmpeg)
    expect(friendlyError(new Error('disco cheio'), pt.errors)).toContain('disco cheio')
  })
})

describe('eco do alto-falante', () => {
  it('tira do microfone a frase que veio do sistema', () => {
    const system = [seg('Outros', 10, 'Vamos fechar a migração do pagamento em dezembro')]
    const mic = [seg('Você', 10.4, 'vamos fechar a migração do pagamento em dezembro'), seg('Você', 30, 'Eu posso cuidar dos testes de carga amanhã')]
    expect(dropEcho(mic, system).map((s) => s.start)).toEqual([30])
    expect(mergeTracks(mic, system).map((t) => t.speaker)).toEqual(['Outros', 'Você'])
  })

  it('mantém resposta curta e fala diferente no mesmo momento', () => {
    const system = [seg('Outros', 10, 'Vamos fechar a migração do pagamento em dezembro')]
    const mic = [seg('Você', 11, 'sim'), seg('Você', 12, 'Acho melhor esperar o fim do trimestre fiscal')]
    expect(dropEcho(mic, system)).toHaveLength(2)
  })
})

describe('gerar o resumo de novo', () => {
  const turns = [{ speaker: 'Você' as const, start: 5, text: 'Vamos migrar em *dezembro*' }]
  const meta = { startedAt: new Date(2026, 10, 27, 9, 0), durationSec: 600 }

  it('troca só o resumo e mantém transcrição, capturas e cabeçalho', () => {
    const shots = [{ link: 'x%20-%20telas/tela-01.jpg', label: 'Tela 1 · 00:03', offsetSec: 3 }]
    const md = buildMeetingMarkdown(meta, null, turns, pt.doc, undefined, shots)
    const parts = splitMeetingNote(md)!
    expect(parts.doc.transcript).toBe(pt.doc.transcript)
    expect(transcriptForSummary(parts.transcript)).toBe('00:05 · Você: Vamos migrar em *dezembro*')
    const next = rebuildWithSummary(parts, summary)
    expect(next).not.toContain(pt.doc.noSummary)
    expect(next).toContain('# Migração do pagamento')
    expect(next).toContain('- [ ] Avisar o time — Ana')
    expect(next).toContain('![Tela 1 · 00:03](x%20-%20telas/tela-01.jpg)')
    expect(next.startsWith('---\ndata: 2026-11-27 09:00')).toBe(true)
    // Rodar de novo sobre a nota já resumida dá o mesmo resultado.
    expect(rebuildWithSummary(splitMeetingNote(next)!, summary)).toBe(next)
  })

  it('mantém o título que a pessoa escolheu e entende nota em inglês', () => {
    const md = buildMeetingMarkdown(meta, { ...summary, assunto: 'Meu título' }, turns, en.doc)
    const parts = splitMeetingNote(md)!
    expect(parts.doc.transcript).toBe(en.doc.transcript)
    expect(rebuildWithSummary(parts, summary)).toContain('# Meu título')
  })

  it('nota sem transcrição não serve', () => {
    expect(splitMeetingNote('# Só uma nota\n\ntexto')).toBeNull()
  })
})

describe('gravações com problema', () => {
  it('lista com o motivo e some ao tentar de novo', async () => {
    const audio = mkdtempSync(join(tmpdir(), 'tfb-failed-'))
    const dir = join(audio, '2026-11-27T12-00-00-000Z')
    mkdirSync(dir)
    writeFileSync(join(dir, 'meta.json'), JSON.stringify({ startedAt: '2026-11-27T12:00:00.000Z', durationSec: 600 }))
    await markProcessing(dir)
    expect(await findFailed(audio)).toEqual([])
    await markFailed(dir, 'A transcrição falhou.')
    const failed = await findFailed(audio)
    expect(failed).toHaveLength(1)
    expect(failed[0]).toMatchObject({ id: '2026-11-27T12-00-00-000Z', durationSec: 600, error: 'A transcrição falhou.', attempts: 1 })
    await resetAttempts(dir)
    expect(await findFailed(audio)).toEqual([])
  })
})

describe('observar a pasta', () => {
  it('só conta notas fora das pastas escondidas', () => {
    expect(isNoteEvent('Reuniões/2026/11/a.md')).toBe(true)
    expect(isNoteEvent('.audio/x/live-mic.json')).toBe(false)
    expect(isNoteEvent('.sync/a.md')).toBe(false)
    expect(isNoteEvent('Reuniões/2026/11/a - telas/tela-01.jpg')).toBe(false)
  })
})

