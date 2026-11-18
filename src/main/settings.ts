import { app, safeStorage } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Settings } from '../shared/types'

interface Stored extends Omit<Settings, 'hasApiKey'> {
  apiKeyEncrypted?: string
}

const file = (): string => join(app.getPath('userData'), 'settings.json')

/** Idioma da transcrição pelo idioma do sistema; dá para trocar nas configurações. */
function defaultLanguage(): string {
  const locale = app.getLocale().toLowerCase()
  if (locale.startsWith('pt')) return 'pt'
  if (locale.startsWith('es')) return 'es'
  return 'en'
}

function defaults(): Stored {
  return {
    rootDir: join(app.getPath('documents'), 'TalkFlowBy'),
    language: defaultLanguage(),
    summaryProvider: 'auto',
    keepAudio: false,
    detectMeetings: true,
    mutedApps: [],
    openAtLogin: true
  }
}

let cache: Stored | null = null

function load(): Stored {
  if (cache) return cache
  let stored: Partial<Stored> = {}
  if (existsSync(file())) {
    try {
      stored = JSON.parse(readFileSync(file(), 'utf8'))
    } catch {
      stored = {}
    }
  }
  cache = { ...defaults(), ...stored }
  return cache
}

async function save(next: Stored): Promise<void> {
  cache = next
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(file(), JSON.stringify(next, null, 2), 'utf8')
}

export function getSettings(): Settings {
  const { apiKeyEncrypted, ...rest } = load()
  return { ...rest, hasApiKey: Boolean(apiKeyEncrypted) }
}

export async function updateSettings(patch: Partial<Omit<Settings, 'hasApiKey'>>): Promise<Settings> {
  await save({ ...load(), ...patch })
  if (patch.openAtLogin !== undefined && app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: patch.openAtLogin, args: ['--hidden'] })
  }
  return getSettings()
}

/** A chave fica cifrada pelo chaveiro do sistema; nunca volta para a janela. */
export async function setApiKey(key: string | null): Promise<Settings> {
  const current = load()
  if (!key) {
    const { apiKeyEncrypted: _, ...rest } = current
    await save(rest)
  } else {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('O sistema não oferece cofre para guardar a chave.')
    await save({ ...current, apiKeyEncrypted: safeStorage.encryptString(key.trim()).toString('base64') })
  }
  return getSettings()
}

export function getApiKey(): string | null {
  const enc = load().apiKeyEncrypted
  if (!enc) return null
  try {
    return safeStorage.decryptString(Buffer.from(enc, 'base64'))
  } catch {
    return null
  }
}
