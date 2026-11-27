import { app, safeStorage } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { dict, langFromLocale } from '../shared/i18n'
import { defaultQuality } from '../shared/models'
import type { Settings } from '../shared/types'
import { followUiLanguage, repairedLanguage } from './language'

interface Stored extends Omit<Settings, 'hasApiKey'> {
  apiKeyEncrypted?: string
  /** O idioma das reuniões já foi acertado com o do app (veja `migrateLanguage`). */
  languageMigrated?: boolean
}

const file = (): string => join(app.getPath('userData'), 'settings.json')

/** Idioma da transcrição pelo idioma do sistema; dá para trocar nas configurações. */
function defaultLanguage(): string {
  const locale = (app.getPreferredSystemLanguages()[0] ?? app.getLocale()).toLowerCase()
  if (locale.startsWith('pt')) return 'pt'
  if (locale.startsWith('es')) return 'es'
  return 'en'
}

/** Corrige, uma vez, o idioma das reuniões de quem veio da 0.2.0 (veja `repairedLanguage`). */
function migrateLanguage(stored: Partial<Stored>): Partial<Stored> {
  if (stored.languageMigrated || !stored.uiLanguage || !stored.language) return {}
  const ui = langFromLocale(app.getPreferredSystemLanguages()[0] ?? app.getLocale())
  const language = repairedLanguage(stored, { ui, language: defaultLanguage() })
  return language ? { language, languageMigrated: true } : { languageMigrated: true }
}

function defaults(): Stored {
  const uiLanguage = langFromLocale(app.getPreferredSystemLanguages()[0] ?? app.getLocale())
  return {
    rootDir: join(app.getPath('documents'), 'TalkFlowBy'),
    uiLanguage,
    folders: { ...dict(uiLanguage).folders },
    language: defaultLanguage(),
    languageMigrated: true,
    summaryProvider: 'auto',
    keepAudio: false,
    detectMeetings: true,
    silenceStopMinutes: 5,
    drawFlows: true,
    transcriptionQuality: defaultQuality(process.platform, process.arch),
    mutedApps: [],
    checkUpdates: true,
    openAtLogin: true,
    syncRemote: ''
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
  const migrated = migrateLanguage(stored)
  cache = { ...defaults(), ...stored, ...inherited(stored), ...migrated }
  // Fixa idioma e nomes de pasta na primeira abertura; trocar o idioma do sistema depois não move as notas.
  if (!stored.folders || !stored.uiLanguage || migrated.languageMigrated) void save(cache)
  return cache
}

/**
 * Quem usou a versão só em português já tem as pastas "Reuniões" e "Notas" (ou transcrição em
 * português): continua em português, com as mesmas pastas, mesmo num sistema em inglês.
 */
function inherited(stored: Partial<Stored>): Partial<Stored> {
  if (stored.folders && stored.uiLanguage) return {}
  const root = stored.rootDir ?? defaults().rootDir
  const ptFolders = dict('pt').folders
  const hasPtFolders = existsSync(join(root, ptFolders.meetings)) || existsSync(join(root, ptFolders.notes))
  if (!hasPtFolders && stored.language !== 'pt') return {}
  return {
    uiLanguage: stored.uiLanguage ?? 'pt',
    folders: stored.folders ?? { ...ptFolders }
  }
}

async function save(next: Stored): Promise<void> {
  cache = next
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(file(), JSON.stringify(next, null, 2), 'utf8')
}

export function getSettings(): Settings {
  const { apiKeyEncrypted, languageMigrated: _, ...rest } = load()
  return { ...rest, hasApiKey: Boolean(apiKeyEncrypted) }
}

export async function updateSettings(patch: Partial<Omit<Settings, 'hasApiKey'>>): Promise<Settings> {
  const current = load()
  await save({ ...current, ...followUiLanguage(current, patch) })
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
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Secure storage is not available on this system.')
    await save({ ...current, apiKeyEncrypted: safeStorage.encryptString(key.trim()).toString('base64') })
  }
  return getSettings()
}

/** Textos no idioma escolhido, para o processo principal (bandeja, avisos, notas). */
export function tr(): ReturnType<typeof dict> {
  return dict(load().uiLanguage)
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
