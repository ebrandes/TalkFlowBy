import { createWriteStream } from 'node:fs'
import { access, mkdir, rename, rm, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ModelStatus } from '../../shared/types'

export const MODEL_FILE = 'ggml-large-v3-turbo-q5_0.bin'
const MODEL_URL = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${MODEL_FILE}`
/** O arquivo tem ~574 MB; abaixo disso o download veio quebrado. */
const MIN_BYTES = 500 * 1024 * 1024

async function exists(p: string): Promise<boolean> {
  try {
    await access(p)
    return (await stat(p)).size >= MIN_BYTES
  } catch {
    return false
  }
}

/** Lugares onde o modelo pode já estar (por exemplo, baixado pelo whisper.cpp antes). */
export function modelCandidates(userDataDir: string): string[] {
  return [join(userDataDir, 'models', MODEL_FILE), join(homedir(), '.cache', 'whisper-cpp', MODEL_FILE)]
}

export async function findModel(userDataDir: string): Promise<string | null> {
  for (const p of modelCandidates(userDataDir)) if (await exists(p)) return p
  return null
}

/** Baixa o modelo para a pasta do app, informando o progresso de 0 a 1. */
export async function downloadModel(userDataDir: string, onProgress: (s: ModelStatus) => void): Promise<string> {
  const target = modelCandidates(userDataDir)[0]
  const partial = `${target}.part`
  await mkdir(dirname(target), { recursive: true })

  const res = await fetch(MODEL_URL)
  if (!res.ok || !res.body) throw new Error(`Não foi possível baixar o modelo (${res.status}).`)
  const total = Number(res.headers.get('content-length') ?? 0)
  let received = 0
  let lastReport = 0

  const body = Readable.fromWeb(res.body as never)
  body.on('data', (chunk: Buffer) => {
    received += chunk.length
    const now = Date.now()
    if (total && now - lastReport > 250) {
      lastReport = now
      onProgress({ ready: false, downloading: true, progress: received / total })
    }
  })

  try {
    await pipeline(body, createWriteStream(partial))
    await rename(partial, target)
  } catch (err) {
    await rm(partial, { force: true })
    throw err
  }
  onProgress({ ready: true, path: target })
  return target
}
