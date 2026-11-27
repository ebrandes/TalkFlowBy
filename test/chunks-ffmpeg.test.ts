// Usa o ffmpeg de verdade: o do pacote ffmpeg-static ou o apontado por FFMPEG_BIN.
import { existsSync, mkdtempSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { analyzeSpeech, cutArgs, cutChunks } from '../src/main/pipeline/chunks'
import { ffmpegPath } from '../src/main/setup/binaries'

const WAV = join(__dirname, 'fixtures', 'tone-gap-tone.wav')

function hasFfmpeg(): boolean {
  try {
    return existsSync(ffmpegPath())
  } catch {
    return false
  }
}

describe('cutArgs', () => {
  it('lê o wav uma vez e grava um arquivo por trecho', () => {
    const args = cutArgs('in.wav', [
      { iv: { start: 0, end: 1.5 }, out: 'a.wav' },
      { iv: { start: 3, end: 4 }, out: 'b.wav' }
    ])
    expect(args.filter((a) => a === '-i')).toHaveLength(1)
    expect(args.slice(-7)).toEqual(['-ss', '3.000', '-to', '4.000', '-c', 'copy', 'b.wav'])
  })
})

describe.skipIf(!hasFfmpeg())('trechos com ffmpeg', () => {
  it('acha as duas falas, o pico e corta cada uma', async () => {
    const a = await analyzeSpeech(WAV)
    expect(a.duration).toBeCloseTo(8, 0)
    expect(a.peakDb).toBeGreaterThan(-20)
    expect(a.intervals).toHaveLength(2)
    expect(a.intervals[1].start).toBeGreaterThan(4.5)
    const dir = mkdtempSync(join(tmpdir(), 'tfb-cut-'))
    const files = await cutChunks(WAV, a.intervals, dir, 'mic')
    expect(files).toHaveLength(2)
    // 16 kHz, 16 bits: ~32 KB por segundo de áudio.
    for (const f of files) expect(statSync(f).size).toBeGreaterThan(80_000)
  })
})
