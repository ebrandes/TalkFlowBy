import { EventEmitter } from 'node:events'
import type { DetectedMeeting } from '../../shared/types'
import { micwatchPath } from '../setup/binaries'
import { callsInWindows, isBrowser, type CallIdentity, type WindowInfo } from './calls'
import { watchHelper, watchMac } from './mac'
import { parseWinReport, pollWindows } from './windows'

/** Tempo com o microfone aberto antes de contar como reunião (evita aviso por um teste rápido). */
export const START_AFTER_MS = 5_000
/** Tempo sem microfone, e sem a janela da reunião, para considerar a reunião encerrada. */
export const END_AFTER_MS = 25_000
/**
 * Com a janela da reunião ainda aberta, a chamada continua mesmo sem microfone: queda de
 * internet, reconexão, microfone trocado. No navegador a aba fica aberta depois de sair, então o limite é menor.
 */
export const HOLD_APP_MS = 10 * 60_000
export const HOLD_BROWSER_MS = 2 * 60_000
/** O microfone fechou por pelo menos isso e voltou noutra reunião: é outra chamada. */
export const SWITCH_GAP_MS = 3_000
/** Janelas que abriram até este tempo antes do microfone contam como a janela da reunião. */
const FRESH_WINDOW_MS = 3 * 60_000
/** Uma aba de reunião vista há pouco deixa o navegador gravar sozinho. */
const BROWSER_TAB_MS = 60_000
const WIN_POLL_MS = 3_000

export interface CallInfo extends DetectedMeeting {
  /** Nome da reunião tirado do título da janela, quando há. */
  title?: string
  /**
   * Há sinal bastante de que é uma reunião para gravar sem perguntar. No navegador o
   * microfone sozinho não basta (pode ser um áudio de WhatsApp): precisa da aba da reunião.
   */
  confident: boolean
}

export interface DetectorEvents {
  start: [CallInfo]
  end: [CallInfo]
  /** Saiu de uma chamada e entrou em outra no mesmo app. */
  switch: [CallInfo, CallInfo]
}

interface Call {
  info: CallInfo
  /** Reuniões (pelas janelas) que já fizeram parte desta chamada. */
  keys: Set<string>
  lastMic: number
  announced: boolean
}

/**
 * Junta os sinais do sistema e decide quando uma reunião começou, terminou ou virou outra.
 * Sinais: quem está com o microfone aberto (por processo) e, no Windows, os títulos das janelas.
 * A lógica de tempo fica em `update`, que também é usada nos testes.
 */
export class MeetingDetector extends EventEmitter<DetectorEvents> {
  private pending = new Map<string, number>()
  private calls = new Map<string, Call>()
  /** Quando cada janela (exe + título) apareceu pela primeira vez. */
  private firstSeen = new Map<string, number>()
  /** Última vez que cada navegador mostrou uma aba de reunião. */
  private tabSeen = new Map<string, number>()
  private stopFn: (() => void) | null = null
  private timer: NodeJS.Timeout | null = null
  private current: DetectedMeeting[] = []
  /** undefined: este sistema não informa as janelas (Mac, helper antigo). */
  private windows: WindowInfo[] | undefined

  constructor(private isMuted: (appId: string) => boolean = () => false) {
    super()
  }

  update(active: DetectedMeeting[], now = Date.now(), windows: WindowInfo[] | undefined = this.windows): void {
    this.current = active
    this.windows = windows
    this.trackWindows(windows ?? [], now)
    const ids = new Set(active.map((a) => a.appId))

    for (const app of active) {
      const seen = this.identities(app.appId, now)
      const call = this.calls.get(app.appId)
      if (!call) {
        if (!this.pending.has(app.appId)) this.pending.set(app.appId, now)
        if (now - this.pending.get(app.appId)! < START_AFTER_MS) continue
        this.pending.delete(app.appId)
        this.begin(app, seen, now)
        continue
      }
      const gap = now - call.lastMic
      const fresh = seen.filter((c) => !call.keys.has(c.key))
      if (gap >= SWITCH_GAP_MS && call.keys.size > 0 && seen.length > 0 && fresh.length === seen.length) {
        // O microfone fechou e voltou com outra reunião na tela: são duas chamadas.
        this.calls.delete(app.appId)
        const next = this.begin(app, seen, now, false)
        if (call.announced && next.announced) this.emit('switch', call.info, next.info)
        else {
          this.emit('end', call.info)
          if (next.announced) this.emit('start', next.info)
        }
        continue
      }
      for (const c of seen) call.keys.add(c.key)
      if (!call.info.title) call.info.title = seen.find((c) => c.title)?.title
      call.lastMic = now
    }

    for (const id of [...this.pending.keys()]) if (!ids.has(id)) this.pending.delete(id)
    for (const [id, call] of [...this.calls]) {
      if (ids.has(id)) continue
      const open = this.identities(id, now).some((c) => call.keys.has(c.key))
      const limit = open ? (isBrowser(id) ? HOLD_BROWSER_MS : HOLD_APP_MS) : END_AFTER_MS
      if (now - call.lastMic >= limit) {
        this.calls.delete(id)
        // O fim vale para qualquer app, mesmo silenciado: uma gravação manual também para.
        this.emit('end', call.info)
      }
    }
  }

  private begin(app: DetectedMeeting, seen: CallIdentity[], now: number, emit = true): Call {
    const browser = isBrowser(app.appId)
    const tab = this.tabSeen.get(app.appId)
    const confident = !browser || seen.length > 0 || (tab !== undefined && now - tab <= BROWSER_TAB_MS)
    const info: CallInfo = { ...app, title: seen.find((c) => c.title)?.title, confident }
    const announced = !this.isMuted(app.appId)
    const call: Call = { info, keys: new Set(seen.map((c) => c.key)), lastMic: now, announced }
    this.calls.set(app.appId, call)
    if (emit && announced) this.emit('start', info)
    return call
  }

  /**
   * Reuniões que as janelas do app mostram. Títulos sem formato de reunião (Teams) só contam
   * se a janela abriu há pouco: a janela principal, aberta há horas, não é a reunião.
   */
  private identities(appId: string, now: number): CallIdentity[] {
    if (!this.windows) return []
    const call = this.calls.get(appId)
    const since = call ? call.lastMic : (this.pending.get(appId) ?? now)
    return callsInWindows(appId, this.windows).filter((c) => {
      if (c.strong || call?.keys.has(c.key)) return true
      const first = this.firstSeen.get(c.key)
      return first !== undefined && first >= since - FRESH_WINDOW_MS
    })
  }

  private trackWindows(windows: WindowInfo[], now: number): void {
    const present = new Set<string>()
    for (const appId of ['teams', 'chrome', 'edge', 'firefox', 'brave', 'arc', 'zoom']) {
      const found = callsInWindows(appId, windows)
      for (const c of found) present.add(c.key)
      if (found.length && isBrowser(appId)) this.tabSeen.set(appId, now)
    }
    for (const key of present) if (!this.firstSeen.has(key)) this.firstSeen.set(key, now)
    for (const key of [...this.firstSeen.keys()]) if (!present.has(key)) this.firstSeen.delete(key)
  }

  /** Algum app de reunião ainda está em chamada? */
  anyInCall(): boolean {
    return this.calls.size > 0
  }

  /** A chamada do app ainda está em curso? */
  inCall(appId: string): CallInfo | null {
    return this.calls.get(appId)?.info ?? null
  }

  /**
   * Esquece a chamada em curso sem avisar o fim: se ela continuar, vira um novo "start".
   * Usado quando a gravação parou por silêncio mas a reunião segue.
   */
  rearm(appId: string): void {
    this.calls.delete(appId)
    this.pending.delete(appId)
  }

  async start(): Promise<void> {
    this.stop()
    // Um relógio regular garante que o "fim" seja percebido mesmo sem novos sinais.
    this.timer = setInterval(() => this.update(this.current), 1_000)
    if (process.platform === 'darwin') {
      const bin = await micwatchPath()
      if (bin) this.stopFn = watchMac(bin, (apps) => this.update(apps))
    } else if (process.platform === 'win32') {
      const bin = await micwatchPath()
      if (bin) {
        this.stopFn = watchHelper(bin, parseWinReport, (r) => this.update(r.apps, Date.now(), r.windows))
        return
      }
      const poll = setInterval(async () => this.update(await pollWindows(), Date.now(), undefined), WIN_POLL_MS)
      this.stopFn = () => clearInterval(poll)
    }
  }

  stop(): void {
    this.stopFn?.()
    this.stopFn = null
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  /** Algum app de reunião está com o microfone aberto agora? */
  isActive(appId: string): boolean {
    return this.current.some((a) => a.appId === appId)
  }
}
