import { existsSync } from 'node:fs'
import { readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { FailedRecording, MeetingMeta } from '../shared/types'

/** Marcadores dentro da pasta de cada gravação. */
export const DONE_FILE = 'done.json'
export const PROCESSING_FILE = 'processing.json'
const MAX_ATTEMPTS = 3

/** "2026-11-18T03-43-11-649Z" → Date (o nome da pasta é o início da gravação). */
export function startFromDirName(name: string): Date | null {
  const m = name.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/)
  if (!m) return null
  const d = new Date(`${m[1]}T${m[2]}:${m[3]}:${m[4]}.${m[5]}Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

export interface PendingSession {
  dir: string
  meta: MeetingMeta
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T
  } catch {
    return null
  }
}

/**
 * Gravações que ficaram para trás: o app fechou gravando (sem meta.json) ou no meio do
 * processamento (processing.json sem done.json). Pastas antigas, já processadas antes
 * destes marcadores existirem, têm meta.json e .wav e ficam de fora.
 */
export async function findPending(audioDir: string): Promise<PendingSession[]> {
  if (!existsSync(audioDir)) return []
  const pending: PendingSession[] = []
  for (const entry of await readdir(audioDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const dir = join(audioDir, entry.name)
    const files = await readdir(dir)
    if (files.includes(DONE_FILE)) continue
    const audio = files.filter((f) => /^(mic|system)\.webm$/.test(f))
    if (audio.length === 0) continue
    const sizes = await Promise.all(audio.map(async (f) => (await stat(join(dir, f))).size))
    if (sizes.every((s) => s < 2048)) continue

    const progress = await readJson<{ attempts?: number }>(join(dir, PROCESSING_FILE))
    if (progress && (progress.attempts ?? 1) >= MAX_ATTEMPTS) continue
    const hasMeta = files.includes('meta.json')
    const hasWav = files.some((f) => f.endsWith('.wav'))
    const interrupted = !hasMeta || Boolean(progress) || !hasWav
    if (!interrupted) continue

    let meta = hasMeta ? await readJson<{ startedAt: string; durationSec: number; origin?: string; title?: string; auto?: boolean }>(join(dir, 'meta.json')) : null
    if (!meta) {
      const begun = await readJson<{ origin?: string; title?: string; auto?: boolean }>(join(dir, 'start.json'))
      const startedAt = startFromDirName(entry.name)
      if (!startedAt) continue
      const lastWrite = Math.max(...(await Promise.all(audio.map(async (f) => (await stat(join(dir, f))).mtimeMs))))
      meta = { startedAt: startedAt.toISOString(), durationSec: Math.max(1, (lastWrite - startedAt.getTime()) / 1000), ...begun }
      await writeFile(join(dir, 'meta.json'), JSON.stringify(meta))
    }
    pending.push({ dir, meta: { startedAt: new Date(meta.startedAt), durationSec: meta.durationSec, origin: meta.origin, title: meta.title, auto: meta.auto } })
  }
  return pending
}

/** Marca o começo do processamento, contando as tentativas. */
export async function markProcessing(dir: string): Promise<void> {
  const prev = await readJson<{ attempts?: number }>(join(dir, PROCESSING_FILE))
  await writeFile(join(dir, PROCESSING_FILE), JSON.stringify({ attempts: (prev?.attempts ?? 0) + 1, at: new Date().toISOString() }))
}

export async function markDone(dir: string, notePath: string): Promise<void> {
  await writeFile(join(dir, DONE_FILE), JSON.stringify({ notePath, at: new Date().toISOString() }))
}

/** Guarda o erro da última tentativa, para a lista de gravações com problema. */
export async function markFailed(dir: string, message: string): Promise<void> {
  const prev = await readJson<{ attempts?: number; at?: string }>(join(dir, PROCESSING_FILE))
  await writeFile(join(dir, PROCESSING_FILE), JSON.stringify({ attempts: prev?.attempts ?? 1, at: prev?.at, lastError: message }))
}

/** Zera as tentativas: a gravação volta a ser processada como nova. */
export async function resetAttempts(dir: string): Promise<void> {
  await rm(join(dir, PROCESSING_FILE), { force: true })
}

export interface FailedSession extends FailedRecording {
  dir: string
}

/** Gravações cujo processamento deu erro e que ainda não viraram nota. */
export async function findFailed(audioDir: string): Promise<FailedSession[]> {
  if (!existsSync(audioDir)) return []
  const out: FailedSession[] = []
  for (const entry of await readdir(audioDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const dir = join(audioDir, entry.name)
    const files = await readdir(dir).catch(() => [] as string[])
    if (files.includes(DONE_FILE)) continue
    const progress = await readJson<{ attempts?: number; lastError?: string }>(join(dir, PROCESSING_FILE))
    if (!progress?.lastError) continue
    const meta = await readJson<{ startedAt?: string; durationSec?: number }>(join(dir, 'meta.json'))
    out.push({
      id: entry.name,
      dir,
      startedAt: meta?.startedAt ?? startFromDirName(entry.name)?.toISOString() ?? new Date().toISOString(),
      durationSec: meta?.durationSec ?? 0,
      error: progress.lastError,
      attempts: progress.attempts ?? 1
    })
  }
  return out.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}
