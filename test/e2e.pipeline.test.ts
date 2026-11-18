// Teste de ponta a ponta do processamento (ffmpeg, Whisper, Haiku, .md) com áudio de vozes sintéticas.
// Só roda com E2E_SESSION apontando para uma pasta com mic.webm e system.webm, e E2E_ROOT para a saída.
import { cpSync, existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { lint } from 'markdownlint/sync'
import { describe, expect, it } from 'vitest'
import type { PipelineStatus } from '../src/shared/types'
import { processRecording } from '../src/main/pipeline/run'
import { whisperPath } from '../src/main/setup/binaries'

const session = process.env.E2E_SESSION
const root = process.env.E2E_ROOT

describe.skipIf(!session || !root)('ponta a ponta', () => {
  it('transforma duas trilhas numa nota legível', async () => {
    const work = join(root!, '.audio', 'teste')
    cpSync(session!, work, { recursive: true })
    const statuses: PipelineStatus[] = []
    const rel = await processRecording(
      { sessionDir: work, meta: { startedAt: new Date(2026, 10, 17, 14, 30), durationSec: 56, origin: 'Google Meet (Chrome)' } },
      {
        rootDir: root!,
        whisper: (await whisperPath())!,
        model: join(homedir(), '.cache', 'whisper-cpp', 'ggml-large-v3-turbo-q5_0.bin'),
        language: 'pt',
        keepAudio: false,
        summary: { provider: 'claude-cli' },
        onStatus: (s) => statuses.push(s)
      }
    )
    const md = readFileSync(join(root!, rel), 'utf8')
    console.log(`\n${rel}\n\n${md}`)
    console.log(statuses.map((s) => `${s.stage}${s.progress !== undefined ? ` ${Math.round(s.progress * 100)}%` : ''}${s.message ? ` (${s.message})` : ''}`).join(' → '))
    expect(statuses.at(-1)?.stage).toBe('done')
    expect(statuses.at(-1)?.message).toBeUndefined()
    expect(md).toContain('**[00:00] Você:**')
    expect(md).toContain('Outros:**')
    expect(md).toContain('## Próximos passos')
    expect(existsSync(work)).toBe(false)
    expect(lint({ strings: { n: md }, config: { default: true, MD013: false } }).n).toEqual([])
  }, 300_000)
})
