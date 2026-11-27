import { app } from 'electron'
import { hostname } from 'node:os'
import { join } from 'node:path'
import type { SyncStatus } from '../shared/types'
import { getSettings } from './settings'
import { gitPath } from './setup/binaries'
import { syncFolder, type SyncResult } from './sync'

/** De quanto em quanto tempo sincroniza sozinho, com o app aberto. */
const INTERVAL_MS = 10 * 60_000
/** Espera depois de uma edição, para juntar várias numa rodada só. */
const AFTER_EDIT_MS = 60_000

/** Nome curto do computador: "MacBook-Air-de-Brandes.local" vira "MacBook-Air-de-Brandes". */
export function deviceName(): string {
  return hostname().replace(/\.(local|lan|home)$/i, '') || 'computador'
}

/**
 * Agenda as rodadas de sincronização: ao abrir, depois de cada nota nova, um minuto depois de
 * editar e a cada 10 minutos. Uma rodada por vez; pedidos no meio viram uma rodada logo depois.
 */
export class SyncService {
  status: SyncStatus = { state: 'off' }
  private running: Promise<void> | null = null
  private again = false
  private timer: ReturnType<typeof setInterval> | null = null
  private debounce: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly onStatus: (s: SyncStatus) => void,
    private readonly onPulled: (r: SyncResult) => void
  ) {}

  private set(next: SyncStatus): void {
    this.status = next
    this.onStatus(next)
  }

  enabled(): boolean {
    return Boolean(getSettings().syncRemote.trim())
  }

  /** Liga ou desliga conforme as configurações; ligar já roda uma vez. */
  restart(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    if (!this.enabled()) {
      this.set({ state: 'off' })
      return
    }
    this.timer = setInterval(() => void this.now(), INTERVAL_MS)
    void this.now()
  }

  /** Depois de uma edição: espera um pouco para juntar as mudanças. */
  soon(): void {
    if (!this.enabled()) return
    if (this.debounce) clearTimeout(this.debounce)
    this.debounce = setTimeout(() => void this.now(), AFTER_EDIT_MS)
  }

  async now(): Promise<SyncStatus> {
    if (!this.enabled()) return this.status
    if (this.running) {
      this.again = true
      await this.running
      return this.status
    }
    this.running = this.round().finally(() => (this.running = null))
    await this.running
    if (this.again) {
      this.again = false
      return this.now()
    }
    return this.status
  }

  private async round(): Promise<void> {
    const settings = getSettings()
    this.set({ ...this.status, state: 'syncing', error: undefined })
    const git = await gitPath()
    if (!git) {
      this.set({ ...this.status, state: 'error', error: 'git-missing' })
      return
    }
    try {
      const res = await syncFolder({
        root: settings.rootDir,
        remote: settings.syncRemote.trim(),
        git,
        device: deviceName(),
        backupDir: join(app.getPath('userData'), 'backups')
      })
      this.set({
        state: 'idle',
        lastSync: new Date().toISOString(),
        conflicts: res.conflicts.length,
        backup: res.backup ?? this.status.backup
      })
      if (res.pulled.length) this.onPulled(res)
    } catch (err) {
      this.set({ ...this.status, state: 'error', error: (err as Error).message })
    }
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    if (this.debounce) clearTimeout(this.debounce)
    this.timer = this.debounce = null
  }
}
