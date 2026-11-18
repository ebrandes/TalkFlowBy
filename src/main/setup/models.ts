import { createWriteStream } from 'node:fs'
import { access, mkdir, rename, rm, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { WhisperModel } from '../../shared/models'
import type { ModelStatus } from '../../shared/types'

const urlOf = (file: string): string => `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${file}`

/** Abaixo de 90% do tamanho esperado o download veio quebrado. */
async function exists(p: string, model: WhisperModel): Promise<boolean> {
  try {
    await access(p)
    return (await stat(p)).size >= model.sizeMb * 1024 * 1024 * 0.9
  } catch {
    return false
  }
}

/** Lugares onde o modelo pode já estar (por exemplo, baixado pelo whisper.cpp antes). */
export function modelCandidates(userDataDir: string, model: WhisperModel): string[] {
  return [join(userDataDir, 'models', model.file), join(homedir(), '.cache', 'whisper-cpp', model.file)]
}

export async function findModel(userDataDir: string, model: WhisperModel): Promise<string | null> {
  for (const p of modelCandidates(userDataDir, model)) if (await exists(p, model)) return p
  return null
}

/** Baixa o modelo para a pasta do app, informando o progresso de 0 a 1. */
export async function downloadModel(userDataDir: string, model: WhisperModel, onProgress: (s: ModelStatus) => void): Promise<string> {
  const target = modelCandidates(userDataDir, model)[0]
  const partial = `${target}.part`
  await mkdir(dirname(target), { recursive: true })

  const res = await fetch(urlOf(model.file))
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
