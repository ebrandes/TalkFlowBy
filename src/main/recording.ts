import { createWriteStream, type WriteStream } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { PipelineStatus, Track } from '../shared/types'

export interface ActiveSession {
  id: string
  dir: string
  startedAt: Date
  origin?: string
  streams: Map<Track, WriteStream>
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
    this.active = { id, dir, startedAt, origin, streams: new Map() }
    return this.active
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

  /** Fecha os arquivos e devolve a sessão pronta para processar. */
  async finish(): Promise<{ session: ActiveSession; durationSec: number } | null> {
    const s = this.active
    if (!s) return null
    this.active = null
    await Promise.all([...s.streams.values()].map((st) => new Promise<void>((r) => st.end(() => r()))))
    const durationSec = (Date.now() - s.startedAt.getTime()) / 1000
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
