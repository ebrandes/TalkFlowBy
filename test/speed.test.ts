import { cpSync, existsSync, mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cliTimeoutMs } from '../src/main/pipeline/summarize'
import { pickIntervals, prepareRange, readProgress, removeChunks, writeProgress } from '../src/main/pipeline/track'
import { batchFiles } from '../src/main/pipeline/whisper'
import { ffmpegPath } from '../src/main/setup/binaries'

function hasFfmpeg(): boolean {
  try {
    return existsSync(ffmpegPath())
  } catch {
    return false
  }
}

describe('lotes do Whisper', () => {
  it('junta o máximo de arquivos que cabe na linha de comando', () => {
    const files = Array.from({ length: 10 }, (_, i) => `/tmp/chunk-${i}.wav`)
    expect(batchFiles(files)).toHaveLength(1)
    const small = batchFiles(files, 60)
    expect(small.flat()).toEqual(files)
    for (const b of small) expect(b.join(' ').length).toBeLessThanOrEqual(60)
    expect(batchFiles(files, 10_000, 4).map((b) => b.length)).toEqual([4, 4, 2])
  })
})

describe('transcrição durante a reunião', () => {
  const ivs = [
    { start: 0, end: 3.2 },
    { start: 10, end: 14 },
    { start: 20, end: 30 }
  ]

  it('no fim pega tudo', () => {
    expect(pickIntervals(ivs, 30, true)).toEqual({ take: ivs, doneRel: 30 })
  })

  it('durante, deixa a fala em curso para a próxima rodada', () => {
    const r = pickIntervals(ivs, 30, false)
    expect(r.take).toEqual(ivs.slice(0, 2))
    expect(r.doneRel).toBe(14)
  })

  it('só silêncio: avança até perto do fim', () => {
    expect(pickIntervals([], 40, false)).toEqual({ take: [], doneRel: 37 })
  })

  it('fala começou e não terminou: avança até o começo dela', () => {
    expect(pickIntervals([{ start: 25, end: 30 }], 30, false)).toEqual({ take: [], doneRel: 25 })
  })

  it('guarda e lê o progresso', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'tfb-live-'))
    expect(await readProgress(dir, 'mic')).toBeNull()
    await writeProgress(dir, 'mic', { doneSec: 12, segments: [{ speaker: 'Você', start: 1, end: 2, text: 'oi' }] })
    expect((await readProgress(dir, 'mic'))?.doneSec).toBe(12)
    expect(readdirSync(dir)).toEqual(['live-mic.json'])
  })
})

describe.skipIf(!hasFfmpeg())('trechos a partir de um ponto da gravação', () => {
  it('começa do segundo pedido e soma o deslocamento', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'tfb-range-'))
    cpSync(join(__dirname, 'fixtures', 'tone-gap-tone.webm'), join(dir, 'mic.webm'))
    const all = await prepareRange(dir, 'mic', 0, true)
    expect(all.chunks).toHaveLength(2)
    await removeChunks(all.chunks)
    const rest = await prepareRange(dir, 'mic', 3.5, true)
    expect(rest.chunks).toHaveLength(1)
    expect(rest.chunks[0].offset).toBeGreaterThan(4.5)
    expect(rest.doneSec).toBeCloseTo(8, 0)
    const live = await prepareRange(dir, 'mic', 0, false)
    // A segunda fala vai até o fim do arquivo: ainda pode estar em curso.
    expect(live.chunks).toHaveLength(1)
    expect(live.doneSec).toBeLessThan(4)
    expect(existsSync(join(dir, 'mic.live.wav'))).toBe(false)
  })
})

describe('tempo do resumo', () => {
  it('cresce com a reunião e tem teto', () => {
    expect(cliTimeoutMs(10_000)).toBe(5 * 60_000)
    expect(cliTimeoutMs(100_000, 3)).toBe(8 * 60_000 + 30_000)
    expect(cliTimeoutMs(10_000_000)).toBe(15 * 60_000)
  })
})
