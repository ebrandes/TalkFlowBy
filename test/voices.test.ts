// Separação das vozes de "Outros": marcação das falas, rótulos na nota e troca de nomes.
import { cpSync, existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { dict } from '../src/shared/i18n'
import type { Segment } from '../src/shared/types'
import { othersLabels, renameOthers, renameSpeakers } from '../src/shared/speakers'
import { assignVoices } from '../src/main/voices/assign'
import { mergeTracks, turnsToPlainText } from '../src/main/pipeline/merge'
import { buildMeetingMarkdown } from '../src/main/pipeline/markdown'
import { processRecording } from '../src/main/pipeline/run'
import { ffmpegPath } from '../src/main/setup/binaries'

const seg = (start: number, end: number, text = 'fala'): Segment => ({ speaker: 'Outros', start, end, text })

describe('assignVoices', () => {
  it('numera as vozes na ordem em que aparecem', () => {
    const segs = [seg(0, 5), seg(6, 11), seg(12, 18)]
    const turns = [
      { start: 0, end: 5.5, speaker: 4 },
      { start: 5.8, end: 11.2, speaker: 1 },
      { start: 11.8, end: 18, speaker: 4 }
    ]
    expect(assignVoices(segs, turns).map((s) => s.voice)).toEqual([1, 2, 1])
  })

  it('com uma voz só, a nota continua com "Outros"', () => {
    const segs = [seg(0, 5), seg(6, 11)]
    expect(assignVoices(segs, [{ start: 0, end: 11, speaker: 0 }])).toBe(segs)
  })

  it('fala sem sobreposição fica com a voz mais próxima ou a da fala anterior', () => {
    const segs = [seg(0, 6), seg(6.5, 7), seg(20, 26), seg(40, 41)]
    const turns = [
      { start: 0, end: 6, speaker: 0 },
      { start: 7.8, end: 8, speaker: 1 },
      { start: 20, end: 26, speaker: 1 }
    ]
    // 6.5–7 está a 0,5 s da primeira voz e 0,8 s da segunda; 40–41 não tem ninguém perto e herda a anterior.
    expect(assignVoices(segs, turns).map((s) => s.voice)).toEqual([1, 1, 2, 2])
  })

  it('voz que quase não falou (eco, ruído) vai para a vizinha', () => {
    const segs = [seg(0, 10), seg(10, 10.5), seg(11, 21)]
    const turns = [
      { start: 0, end: 10, speaker: 0 },
      { start: 10, end: 10.5, speaker: 2 },
      { start: 11, end: 21, speaker: 1 }
    ]
    expect(assignVoices(segs, turns).map((s) => s.voice)).toEqual([1, 1, 2])
  })
})

describe('rótulos na nota', () => {
  const d = dict('pt').doc
  const turns = mergeTracks([{ speaker: 'Você', start: 0, end: 2, text: 'Bom dia a todos.' }], [
    { ...seg(3, 5, 'Bom dia.'), voice: 1 },
    { ...seg(5.2, 7, 'Oi, tudo bem?'), voice: 2 },
    { ...seg(7.2, 9, 'Vamos começar.'), voice: 2 }
  ])

  it('vozes diferentes viram parágrafos diferentes', () => {
    expect(turns.map((t) => [t.speaker, t.voice])).toEqual([['Você', undefined], ['Outros', 1], ['Outros', 2]])
    expect(turnsToPlainText(turns)).toContain('Outros 2: Oi, tudo bem? Vamos começar.')
  })

  it('a transcrição mostra "Outros 1" e "Outros 2"', () => {
    const md = buildMeetingMarkdown({ startedAt: new Date(2026, 10, 27, 9, 0), durationSec: 9 }, null, turns, d)
    expect(md).toContain('**00:03 · Outros 1:** Bom dia.')
    expect(md).toContain('**00:05 · Outros 2:** Oi, tudo bem? Vamos começar.')
    expect(othersLabels(md)).toEqual(['Outros 1', 'Outros 2'])
  })
})

describe('renameSpeakers', () => {
  const md = [
    '> Outros 2 vai mandar o cronograma. Outros 10 não existe.',
    '',
    '- [ ] Enviar cronograma — Outros 2',
    '',
    '**00:03 · Outros 1:** Bom dia.',
    '',
    '**00:05 · Outros 2:** Eu mando o cronograma.'
  ].join('\n')

  it('troca cada voz pelo nome, também no resumo', () => {
    const out = renameSpeakers(md, { 'Outros 1': 'Ana', 'Outros 2': 'Bruno' })
    expect(out).toContain('> Bruno vai mandar o cronograma. Outros 10 não existe.')
    expect(out).toContain('— Bruno')
    expect(out).toContain('**00:03 · Ana:** Bom dia.')
    expect(out).toContain('**00:05 · Bruno:** Eu mando o cronograma.')
    expect(othersLabels(out)).toEqual([])
  })

  it('voz sem nome fica como estava', () => {
    const out = renameSpeakers(md, { 'Outros 2': 'Bruno' })
    expect(othersLabels(out)).toEqual(['Outros 1'])
  })

  it('"Outros" sem número continua trocando só na transcrição', () => {
    const plain = '> Outros concordaram.\n\n**00:01 · Outros:** Sim.'
    expect(renameOthers(plain, 'Ana')).toBe('> Outros concordaram.\n\n**00:01 · Ana:** Sim.')
  })
})

function canRunFfmpeg(): boolean {
  if (process.platform === 'win32') return false
  try {
    return existsSync(ffmpegPath())
  } catch {
    return false
  }
}

describe.skipIf(!canRunFfmpeg())('pipeline com separação de vozes', () => {
  it('passa o áudio do sistema para a separação e marca as falas', async () => {
    const root = mkdtempSync(join(tmpdir(), 'tfb-voices-'))
    const dir = join(root, '.audio', '2026-11-27T12-00-00-000Z')
    cpSync(join(__dirname, 'fixtures', 'tone-gap-tone.webm'), join(dir, 'system.webm'))
    let seenDuration = 0
    const rel = await processRecording(
      { sessionDir: dir, meta: { startedAt: new Date(2026, 10, 27, 9, 0), durationSec: 8 } },
      {
        rootDir: root,
        lang: 'pt',
        meetingsFolder: 'Reuniões',
        whisper: join(__dirname, 'fixtures', 'bin', 'fake-whisper.mjs'),
        model: 'x',
        language: 'pt',
        keepAudio: false,
        drawFlows: false,
        summary: { provider: 'api', apiKey: null },
        onStatus: () => undefined,
        voices: async (wav, durationSec) => {
          expect(existsSync(wav)).toBe(true)
          seenDuration = durationSec
          // Primeiro tom é uma pessoa; o resto, outra.
          return [
            { start: 0, end: 2.5, speaker: 5 },
            { start: 2.5, end: 60, speaker: 0 }
          ]
        }
      }
    )
    const md = readFileSync(join(root, rel), 'utf8')
    expect(seenDuration).toBeGreaterThan(5)
    expect(othersLabels(md)).toEqual(['Outros 1', 'Outros 2'])
  })
})

const models = process.env.TFB_VOICES_DIR
describe.skipIf(!models || !existsSync(join(models ?? '', 'sample.wav')))('sherpa-onnx de verdade', () => {
  it('acha as 4 vozes do áudio de exemplo', async () => {
    const { diarizeFile } = await import('../src/main/voices/diarize')
    const turns = diarizeFile({
      wav: join(models!, 'sample.wav'),
      segmentation: join(models!, 'segmentation.onnx'),
      embedding: join(models!, 'embedding.onnx'),
      threads: 2
    })
    expect(new Set(turns.map((t) => t.speaker)).size).toBe(4)
  }, 120_000)
})
