import { EventEmitter } from 'node:events'
import type { DetectedMeeting } from '../../shared/types'
import { micwatchPath } from '../setup/binaries'
import { watchMac } from './mac'
import { pollWindows } from './windows'

/** Tempo com o microfone aberto antes de perguntar (evita aviso por um teste rápido). */
export const START_AFTER_MS = 5_000
/** Tempo sem microfone para considerar a reunião encerrada. */
export const END_AFTER_MS = 30_000
const WIN_POLL_MS = 3_000

export interface DetectorEvents {
  start: [DetectedMeeting]
  end: [DetectedMeeting]
}

/**
 * Junta os sinais do sistema e decide quando uma reunião começou e terminou.
 * A lógica de tempo fica em `update`, que também é usada nos testes.
 */
export class MeetingDetector extends EventEmitter<DetectorEvents> {
  private since = new Map<string, number>()
  /** Apps que ficaram com o microfone tempo bastante para contar como reunião. */
  private inCall = new Map<string, DetectedMeeting>()
  private prompted = new Set<string>()
  private lastSeen = new Map<string, number>()
  private stopFn: (() => void) | null = null
  private timer: NodeJS.Timeout | null = null
  private current: DetectedMeeting[] = []

  constructor(private isMuted: (appId: string) => boolean = () => false) {
    super()
  }

  update(active: DetectedMeeting[], now = Date.now()): void {
    this.current = active
    const ids = new Set(active.map((a) => a.appId))
    for (const app of active) {
      if (!this.since.has(app.appId)) this.since.set(app.appId, now)
      this.lastSeen.set(app.appId, now)
      const long = now - this.since.get(app.appId)! >= START_AFTER_MS
      if (!long) continue
      this.inCall.set(app.appId, app)
      // O aviso respeita o "nunca para este app"; o fim da reunião vale para qualquer app.
      if (!this.prompted.has(app.appId) && !this.isMuted(app.appId)) {
        this.prompted.add(app.appId)
        this.emit('start', app)
      }
    }
    for (const id of [...this.since.keys()]) if (!ids.has(id)) this.since.delete(id)
    for (const [id, app] of [...this.inCall]) {
      if (ids.has(id)) continue
      if (now - (this.lastSeen.get(id) ?? 0) >= END_AFTER_MS) {
        this.inCall.delete(id)
        this.prompted.delete(id)
        this.emit('end', app)
      }
    }
  }

  /** Algum app de reunião ainda está com o microfone aberto? */
  anyInCall(): boolean {
    return this.inCall.size > 0
  }

  async start(): Promise<void> {
    this.stop()
    // Um relógio regular garante que o "fim" seja percebido mesmo sem novos sinais.
    this.timer = setInterval(() => this.update(this.current), 1_000)
    if (process.platform === 'darwin') {
      const bin = await micwatchPath()
      if (bin) this.stopFn = watchMac(bin, (apps) => this.update(apps))
    } else if (process.platform === 'win32') {
      const poll = setInterval(async () => this.update(await pollWindows()), WIN_POLL_MS)
      this.stopFn = () => clearInterval(poll)
    }
  }

  stop(): void {
    this.stopFn?.()
    this.stopFn = null
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  /** Depois de gravar ou recusar, esquece a reunião para não perguntar de novo na mesma chamada. */
  isActive(appId: string): boolean {
    return this.current.some((a) => a.appId === appId)
  }
}
