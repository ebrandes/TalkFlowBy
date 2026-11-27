import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

/** Nota salva sem resumo (sem internet, Claude fora do ar) que ainda vai ganhar um. */
export interface PendingSummary {
  path: string
  since: string
  attempts: number
}

/** Tenta de novo a cada tanto, por até alguns dias. */
export const RETRY_EVERY_MS = 5 * 60_000
export const GIVE_UP_AFTER_MS = 3 * 24 * 60 * 60_000
export const MAX_ATTEMPTS = 100

export type Resummarize = (rel: string) => Promise<{ ok: boolean }>

/**
 * Lista das notas sem resumo, guardada em disco para valer depois de reiniciar o app.
 * Quando a internet volta, gera o resumo delas sem ninguém precisar lembrar.
 */
export class SummaryRetry {
  private list: PendingSummary[] | null = null
  private timer: NodeJS.Timeout | null = null
  private running = false

  constructor(
    private file: string,
    private rootDir: () => string,
    private resummarize: Resummarize,
    private online: () => boolean = () => true,
    private onDone: (paths: string[]) => void = () => undefined
  ) {}

  private async load(): Promise<PendingSummary[]> {
    if (this.list) return this.list
    try {
      const raw = JSON.parse(await readFile(this.file, 'utf8')) as PendingSummary[]
      this.list = Array.isArray(raw) ? raw.filter((p) => typeof p?.path === 'string') : []
    } catch {
      this.list = []
    }
    return this.list
  }

  private async save(): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true })
    await writeFile(this.file, JSON.stringify(this.list ?? [], null, 2), 'utf8')
  }

  async add(path: string, now = new Date()): Promise<void> {
    const list = await this.load()
    if (!list.some((p) => p.path === path)) list.push({ path, since: now.toISOString(), attempts: 0 })
    await this.save()
  }

  async pending(): Promise<PendingSummary[]> {
    return [...(await this.load())]
  }

  start(): void {
    this.stop()
    this.timer = setInterval(() => void this.run(), RETRY_EVERY_MS)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  /** Uma rodada: tenta cada nota pendente. Devolve as que ganharam resumo. */
  async run(now = Date.now()): Promise<string[]> {
    if (this.running || !this.online()) return []
    this.running = true
    const done: string[] = []
    try {
      const list = await this.load()
      for (const item of [...list]) {
        const drop = (): void => {
          list.splice(list.indexOf(item), 1)
        }
        // A nota foi apagada ou movida: não há mais o que resumir.
        if (!existsSync(join(this.rootDir(), item.path))) {
          drop()
          continue
        }
        if (now - new Date(item.since).getTime() > GIVE_UP_AFTER_MS || item.attempts >= MAX_ATTEMPTS) {
          drop()
          continue
        }
        item.attempts++
        const res = await this.resummarize(item.path).catch(() => ({ ok: false }))
        if (res.ok) {
          drop()
          done.push(item.path)
        } else if (!this.online()) break
      }
      await this.save()
    } finally {
      this.running = false
    }
    if (done.length) this.onDone(done)
    return done
  }
}
