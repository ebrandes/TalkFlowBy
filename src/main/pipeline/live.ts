import type { Segment } from '../../shared/types'
import { prepareRange, readProgress, removeChunks, TRACKS, writeProgress } from './track'
import { backgroundThreads, transcribe } from './whisper'

/** De quanto em quanto tempo olha o áudio novo durante a reunião. */
const EVERY_MS = 45_000

export interface LiveOptions {
  sessionDir: string
  whisper: string
  whisperFallback?: string
  model: string
  language: string
  greedy?: boolean
  /** Outra reunião sendo processada: espera, para não disputar o processador. */
  busy?: () => boolean
}

/**
 * Transcreve a reunião enquanto ela acontece, com metade do processador, e guarda o progresso
 * em `live-<trilha>.json`. Quando a gravação termina, só falta o último pedaço e o resumo.
 * Qualquer erro aqui só atrasa: o processamento final transcreve o que faltar.
 */
export class LiveTranscriber {
  private timer: ReturnType<typeof setInterval> | null = null
  private round: Promise<void> | null = null
  private stopped = false

  constructor(private opts: LiveOptions) {}

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => this.tick(), EVERY_MS)
  }

  private tick(): void {
    if (this.round || this.stopped || this.opts.busy?.()) return
    this.round = this.runRound()
      .catch(() => undefined)
      .finally(() => (this.round = null))
  }

  /** Para de agendar e espera a rodada em curso terminar (para não cortar a escrita do progresso). */
  async stop(): Promise<void> {
    this.stopped = true
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    await this.round
  }

  private async runRound(): Promise<void> {
    for (const { track, speaker } of TRACKS) {
      if (this.stopped) return
      const dir = this.opts.sessionDir
      const prev = await readProgress(dir, track)
      const range = await prepareRange(dir, track, prev?.doneSec ?? 0, false)
      let fresh: Segment[] = []
      try {
        if (range.chunks.length) {
          fresh = await transcribe({
            binary: this.opts.whisper,
            fallbackBinary: this.opts.whisperFallback,
            model: this.opts.model,
            chunks: range.chunks,
            speaker,
            language: this.opts.language,
            greedy: this.opts.greedy,
            threads: backgroundThreads()
          })
        }
        if (range.doneSec > (prev?.doneSec ?? 0)) {
          await writeProgress(dir, track, { doneSec: range.doneSec, segments: [...(prev?.segments ?? []), ...fresh] })
        }
      } finally {
        await removeChunks(range.chunks)
      }
    }
  }
}
