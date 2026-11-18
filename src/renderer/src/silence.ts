/** Nível (RMS, 0 a 1) a partir do qual conta como alguém falando. Fica abaixo da fala baixa e acima do chiado. */
export const SOUND_LEVEL = 0.008
const CHECK_MS = 1_000

/**
 * Olha o volume das trilhas a cada segundo e avisa quando todas ficam em silêncio
 * por mais tempo que o limite. Serve para parar uma gravação esquecida.
 */
export class SilenceWatch {
  private ctx: AudioContext | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private lastSound = Date.now()
  private fired = false

  start(streams: MediaStream[], limitMs: number, onSilence: () => void): void {
    this.stop()
    if (limitMs <= 0 || streams.length === 0) return
    this.ctx = new AudioContext()
    const analysers = streams.map((s) => {
      const a = this.ctx!.createAnalyser()
      a.fftSize = 2048
      this.ctx!.createMediaStreamSource(s).connect(a)
      return a
    })
    const buf = new Float32Array(2048)
    this.lastSound = Date.now()
    this.fired = false
    this.timer = setInterval(() => {
      const loud = analysers.some((a) => {
        a.getFloatTimeDomainData(buf)
        let sum = 0
        for (const v of buf) sum += v * v
        return Math.sqrt(sum / buf.length) > SOUND_LEVEL
      })
      const now = Date.now()
      if (loud || this.paused) this.lastSound = now
      else if (!this.fired && now - this.lastSound >= limitMs) {
        this.fired = true
        onSilence()
      }
    }, CHECK_MS)
  }

  private paused = false

  /** Em pausa não conta silêncio: ao voltar, o relógio recomeça. */
  setPaused(paused: boolean): void {
    this.paused = paused
    this.lastSound = Date.now()
  }

  /** Quanto tempo faz que alguma trilha teve som (Infinity se não está observando). */
  msSinceSound(): number {
    return this.timer ? Date.now() - this.lastSound : Number.POSITIVE_INFINITY
  }

  stop(): void {
    this.paused = false
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    void this.ctx?.close()
    this.ctx = null
  }
}
