// Separação de vozes com o sherpa-onnx, no próprio computador (sem internet e sem custo).
// Roda fora da janela (num processo à parte), porque o cálculo trava a thread enquanto dura.
import { createRequire } from 'node:module'
import type { VoiceTurn } from './assign'

export interface DiarizeJob {
  wav: string
  segmentation: string
  embedding: string
  threads: number
}

interface SherpaSegment {
  start: number
  end: number
  speaker: number
}

interface Sherpa {
  readWave: (file: string, enableExternalBuffer?: boolean) => { samples: Float32Array; sampleRate: number }
  OfflineSpeakerDiarization: new (config: unknown) => { sampleRate: number; process: (samples: Float32Array) => SherpaSegment[] }
}

/** Quão parecidas duas vozes precisam ser para contar como a mesma pessoa (menor junta menos). */
export const CLUSTER_THRESHOLD = 0.5

export function diarizeFile(job: DiarizeJob): VoiceTurn[] {
  const sherpa = createRequire(import.meta.url)('sherpa-onnx-node') as Sherpa
  const sd = new sherpa.OfflineSpeakerDiarization({
    segmentation: { pyannote: { model: job.segmentation }, numThreads: job.threads },
    embedding: { model: job.embedding, numThreads: job.threads },
    clustering: { numClusters: -1, threshold: CLUSTER_THRESHOLD },
    minDurationOn: 0.3,
    minDurationOff: 0.5
  })
  // Electron não aceita buffers externos (cage de memória do V8): pede uma cópia.
  const wave = sherpa.readWave(job.wav, false)
  if (wave.sampleRate !== sd.sampleRate) throw new Error(`Áudio em ${wave.sampleRate} Hz; a separação espera ${sd.sampleRate} Hz.`)
  return sd.process(wave.samples).map((s) => ({ start: s.start, end: s.end, speaker: s.speaker }))
}
