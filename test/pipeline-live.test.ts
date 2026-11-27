// Pipeline inteiro com ffmpeg de verdade e um Whisper de mentira (não precisa do modelo).
import { cpSync, existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LiveTranscriber } from '../src/main/pipeline/live'
import { processRecording } from '../src/main/pipeline/run'
import { readProgress } from '../src/main/pipeline/track'
import { ffmpegPath } from '../src/main/setup/binaries'

const FAKE = join(__dirname, 'fixtures', 'bin', 'fake-whisper.mjs')

function canRun(): boolean {
  if (process.platform === 'win32') return false
  try {
    return existsSync(ffmpegPath())
  } catch {
    return false
  }
}

describe.skipIf(!canRun())('pipeline com transcrição durante a reunião', () => {
  it('continua de onde a rodada ao vivo parou, sem repetir falas', async () => {
    const root = mkdtempSync(join(tmpdir(), 'tfb-pipe-'))
    const dir = join(root, '.audio', '2026-11-27T12-00-00-000Z')
    cpSync(join(__dirname, 'fixtures', 'tone-gap-tone.webm'), join(dir, 'mic.webm'))

    const live = new LiveTranscriber({ sessionDir: dir, whisper: FAKE, model: 'x', language: 'pt' })
    await (live as unknown as { runRound: () => Promise<void> }).runRound()
    const progress = await readProgress(dir, 'mic')
    expect(progress?.segments).toHaveLength(1)

    const rel = await processRecording(
      { sessionDir: dir, meta: { startedAt: new Date(2026, 10, 27, 9, 0), durationSec: 8 } },
      {
        rootDir: root,
        lang: 'pt',
        meetingsFolder: 'Reuniões',
        whisper: FAKE,
        model: 'x',
        language: 'pt',
        keepAudio: false,
        drawFlows: false,
        summary: { provider: 'api', apiKey: null },
        onStatus: () => undefined
      }
    )
    const md = readFileSync(join(root, rel), 'utf8')
    expect(md.match(/fala mic-/g)).toHaveLength(2)
    expect(existsSync(dir)).toBe(false)
  })
})
