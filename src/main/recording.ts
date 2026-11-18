import { createWriteStream, type WriteStream } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { PipelineStatus, Track } from '../shared/types'
import type { Shot } from './pipeline/shots'

export interface ActiveSession {
  id: string
  dir: string
  startedAt: Date
  origin?: string
  streams: Map<Track, WriteStream>
  /** Pausas já encerradas, em ms. */
  pausedMs: number
  /** Início da pausa atual. */
  pausedAt: Date | null
  /** Capturas de tela feitas durante a gravação. */
  shots: Shot[]
}

/** Recebe os pedaços de áudio que a janela manda e grava em `.audio/<sessão>/`. */
export class RecordingStore {
  private active: ActiveSession | null = null

  constructor(private rootDir: () => string) {}

  get current(): ActiveSession | null {
    return this.active
  }

  async begin(origin?: string): Promise<ActiveSession> {
    if (this.active) return this.active
    const startedAt = new Date()
    const id = startedAt.toISOString().replace(/[:.]/g, '-')
    const dir = join(this.rootDir(), '.audio', id)
    await mkdir(dir, { recursive: true })
    this.active = { id, dir, startedAt, origin, streams: new Map(), pausedMs: 0, pausedAt: null, shots: [] }
    return this.active
  }

  /** Marca a pausa; o áudio para de chegar porque o gravador da janela também pausa. */
  setPaused(paused: boolean, now = new Date()): void {
    const s = this.active
    if (!s || paused === Boolean(s.pausedAt)) return
    if (paused) s.pausedAt = now
    else {
      s.pausedMs += now.getTime() - s.pausedAt!.getTime()
      s.pausedAt = null
    }
  }

  append(track: Track, chunk: ArrayBuffer): void {
    const s = this.active
    if (!s) return
    let stream = s.streams.get(track)
    if (!stream) {
      stream = createWriteStream(join(s.dir, `${track}.webm`))
      s.streams.set(track, stream)
    }
    stream.write(Buffer.from(chunk))
  }

  /**
   * Guarda uma captura na pasta da gravação, com o segundo da reunião em que foi feita.
   * A lista vai para `shots.json` na hora, então uma queda do app não perde as capturas.
   */
  async addShot(full: Buffer, small: Buffer, offsetSec: number): Promise<number> {
    const s = this.active
    if (!s) return 0
    const n = String(s.shots.length + 1).padStart(3, '0')
    await mkdir(join(s.dir, 'shots'), { recursive: true })
    // Caminhos com "/": a pasta pode ser aberta depois em outro sistema.
    const shot: Shot = { file: `shots/${n}.jpg`, small: `shots/${n}.small.jpg`, offsetSec }
    await writeFile(join(s.dir, shot.file), full)
    await writeFile(join(s.dir, shot.small), small)
    s.shots.push(shot)
    await writeFile(join(s.dir, 'shots.json'), JSON.stringify(s.shots))
    return s.shots.length
  }

  /** Fecha os arquivos e devolve a sessão pronta para processar. */
  async finish(): Promise<{ session: ActiveSession; durationSec: number } | null> {
    const s = this.active
    if (!s) return null
    this.active = null
    await Promise.all([...s.streams.values()].map((st) => new Promise<void>((r) => st.end(() => r()))))
    s.pausedMs += s.pausedAt ? Date.now() - s.pausedAt.getTime() : 0
    s.pausedAt = null
    // A duração da nota é o tempo gravado, sem as pausas.
    const durationSec = (Date.now() - s.startedAt.getTime() - s.pausedMs) / 1000
    await writeFile(join(s.dir, 'meta.json'), JSON.stringify({ startedAt: s.startedAt, durationSec, origin: s.origin }))
    return { session: s, durationSec }
  }
}

/** Fila simples: uma gravação processada por vez, as outras esperam. */
export class ProcessingQueue {
  private chain: Promise<unknown> = Promise.resolve()
  private pending = 0

  constructor(private onStatus: (s: PipelineStatus) => void) {}

  get size(): number {
    return this.pending
  }

  push(job: () => Promise<unknown>): void {
    this.pending++
    this.chain = this.chain
      .then(job)
      .catch((err: Error) => this.onStatus({ stage: 'error', message: err.message }))
      .finally(() => this.pending--)
  }
}
