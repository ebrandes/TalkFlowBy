/** Níveis de qualidade da transcrição: modelo do Whisper e modo de decodificação. */
export type TranscriptionQuality = 'best' | 'balanced' | 'fast'

export interface WhisperModel {
  name: string
  file: string
  sizeMb: number
  /** Decodificação simples (uma hipótese por vez): bem mais rápida, quase sem perda nos modelos menores. */
  greedy: boolean
}

export const WHISPER_MODELS: Record<TranscriptionQuality, WhisperModel> = {
  best: { name: 'Whisper large-v3-turbo', file: 'ggml-large-v3-turbo-q5_0.bin', sizeMb: 574, greedy: false },
  balanced: { name: 'Whisper small', file: 'ggml-small-q5_1.bin', sizeMb: 190, greedy: true },
  fast: { name: 'Whisper base', file: 'ggml-base-q5_1.bin', sizeMb: 60, greedy: true }
}

/**
 * Mac com chip Apple usa a placa de vídeo e roda o modelo grande rápido.
 * Windows e Mac Intel transcrevem no processador: o equilibrado é ~4x mais rápido.
 */
export function defaultQuality(platform: string, arch: string): TranscriptionQuality {
  return platform === 'darwin' && arch === 'arm64' ? 'best' : 'balanced'
}
