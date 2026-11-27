import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { cpus } from 'node:os'
import type { Segment, Speaker } from '../../shared/types'

interface WhisperJson {
  transcription?: { offsets?: { from: number; to: number }; text?: string }[]
}

/** Lê o JSON do whisper.cpp e devolve segmentos em segundos, somando o início do trecho. */
export function parseWhisperJson(json: WhisperJson, speaker: Speaker, offsetSec = 0): Segment[] {
  return (json.transcription ?? [])
    .filter((t) => t.offsets && typeof t.text === 'string')
    .map((t) => ({
      speaker,
      start: offsetSec + (t.offsets!.from ?? 0) / 1000,
      end: offsetSec + (t.offsets!.to ?? 0) / 1000,
      text: (t.text ?? '').trim()
    }))
    .filter((s) => s.text.length > 0)
}

export interface TranscribeOptions {
  binary: string
  model: string
  /** Trechos com voz, cada um com o segundo em que começa na gravação. */
  chunks: { file: string; offset: number }[]
  speaker: Speaker
  language: string
  /** Decodificação simples, mais rápida (modelos menores). */
  greedy?: boolean
  /** Linhas de processamento; menos durante a reunião, para não pesar na chamada. */
  threads?: number
  /** Whisper só com CPU, usado se o de GPU falhar (driver ausente ou antigo). */
  fallbackBinary?: string
  onProgress?: (fraction: number) => void
}

/**
 * Cada lote carrega o modelo uma vez, então lotes grandes são mais rápidos. O limite é o
 * tamanho da linha de comando, que o Windows corta perto de 32 mil caracteres.
 */
const MAX_BATCH_CHARS = 24_000
const MAX_BATCH_FILES = 400

/** Divide os arquivos em lotes que cabem numa linha de comando. */
export function batchFiles(files: string[], maxChars = MAX_BATCH_CHARS, maxFiles = MAX_BATCH_FILES): string[][] {
  const out: string[][] = []
  let cur: string[] = []
  let len = 0
  for (const f of files) {
    if (cur.length > 0 && (len + f.length + 3 > maxChars || cur.length >= maxFiles)) {
      out.push(cur)
      cur = []
      len = 0
    }
    cur.push(f)
    len += f.length + 3
  }
  if (cur.length) out.push(cur)
  return out
}

export function defaultThreads(): number {
  return Math.max(2, Math.min(8, cpus().length - 1))
}

/** Metade das linhas, para a transcrição durante a reunião não travar a chamada. */
export function backgroundThreads(): number {
  return Math.max(1, Math.min(4, Math.floor(cpus().length / 2) - 1))
}

/** Se o Whisper de GPU falhar uma vez, o resto da sessão do app usa o de CPU. */
let gpuBroken = false

function runBatch(binary: string, args: string[], onFileDone: () => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { windowsHide: true })
    let tail = ''
    let started = 0
    const onData = (d: Buffer): void => {
      const text = d.toString()
      tail = (tail + text).slice(-2000)
      const hits = text.match(/processing '/g)?.length ?? 0
      for (let i = 0; i < hits; i++) {
        if (started > 0) onFileDone()
        started++
      }
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`Whisper falhou (${code}): ${tail.trim().split('\n').pop()}`))
      if (started > 0) onFileDone()
      resolve()
    })
  })
}

/**
 * Transcreve os trechos de uma trilha carregando o modelo uma vez por lote.
 * `-mc 0` evita que ele entre em laço repetindo a frase anterior.
 */
export async function transcribe(opts: TranscribeOptions): Promise<Segment[]> {
  if (opts.chunks.length === 0) return []
  const threads = String(opts.threads ?? defaultThreads())
  const decode = opts.greedy ? ['-bs', '1', '-bo', '1'] : []
  let done = 0
  for (const files of batchFiles(opts.chunks.map((c) => c.file))) {
    const args = ['-m', opts.model, '-l', opts.language, '-t', threads, '-mc', '0', ...decode, '-oj', ...files]
    const before = done
    const onFileDone = (): void => {
      done++
      opts.onProgress?.(Math.min(1, done / opts.chunks.length))
    }
    const useGpu = Boolean(opts.fallbackBinary) && !gpuBroken
    try {
      await runBatch(useGpu ? opts.binary : (opts.fallbackBinary ?? opts.binary), args, onFileDone)
    } catch (err) {
      if (!useGpu) throw err
      gpuBroken = true
      done = before
      await runBatch(opts.fallbackBinary!, args, onFileDone)
    }
  }

  const segments: Segment[] = []
  for (const c of opts.chunks) {
    const json = JSON.parse(await readFile(`${c.file}.json`, 'utf8')) as WhisperJson
    segments.push(...parseWhisperJson(json, opts.speaker, c.offset))
  }
  return segments
}
