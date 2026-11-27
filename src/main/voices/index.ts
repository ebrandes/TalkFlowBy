import { utilityProcess } from 'electron'
import { existsSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { join } from 'node:path'
import workerPath from './worker?modulePath'
import { bundledBinDir } from '../setup/binaries'
import type { VoiceTurn } from './assign'

/** Modelos que vão junto com o app (veja scripts/fetch-binaries.mjs). */
export function voiceModels(): { segmentation: string; embedding: string } | null {
  const dir = join(bundledBinDir(), 'voices')
  const segmentation = join(dir, 'segmentation.onnx')
  const embedding = join(dir, 'embedding.onnx')
  return existsSync(segmentation) && existsSync(embedding) ? { segmentation, embedding } : null
}

/** Usa parte dos núcleos, para não disputar com o Whisper, que roda ao mesmo tempo. */
const threads = (): number => Math.max(2, Math.min(4, Math.floor(availableParallelism() / 3)))

/**
 * Separa as vozes de um .wav de 16 kHz. Devolve null se não der (sem modelo, erro ou demora demais);
 * nesse caso a nota sai com "Outros", como antes.
 */
export function detectVoices(wav: string, durationSec: number): Promise<VoiceTurn[] | null> {
  const models = voiceModels()
  if (!models) return Promise.resolve(null)
  // Em média leva 1/10 da duração; o limite folgado evita segurar a nota se algo travar.
  const limitMs = Math.max(120_000, durationSec * 400)
  return new Promise((resolve) => {
    const child = utilityProcess.fork(workerPath, [], { serviceName: 'TalkFlowBy voices', stdio: 'ignore' })
    let settled = false
    const finish = (turns: VoiceTurn[] | null): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      child.kill()
      resolve(turns)
    }
    const timer = setTimeout(() => finish(null), limitMs)
    child.on('message', (m: { ok: boolean; turns?: VoiceTurn[]; error?: string }) => {
      if (!m.ok) console.warn('Separação de vozes falhou:', m.error)
      finish(m.ok ? (m.turns ?? null) : null)
    })
    child.on('exit', () => finish(null))
    child.postMessage({ wav, ...models, threads: threads() })
  })
}
