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
  onProgress?: (fraction: number) => void
}

/** Lotes pequenos mantêm a linha de comando curta (o Windows limita o tamanho). */
const BATCH = 40

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
  const threads = String(Math.max(2, Math.min(8, cpus().length - 1)))
  let done = 0
  for (let i = 0; i < opts.chunks.length; i += BATCH) {
    const files = opts.chunks.slice(i, i + BATCH).map((c) => c.file)
    const decode = opts.greedy ? ['-bs', '1', '-bo', '1'] : []
    const args = ['-m', opts.model, '-l', opts.language, '-t', threads, '-mc', '0', ...decode, '-oj', ...files]
    await runBatch(opts.binary, args, () => {
      done++
      opts.onProgress?.(Math.min(1, done / opts.chunks.length))
    })
  }

  const segments: Segment[] = []
  for (const c of opts.chunks) {
    const json = JSON.parse(await readFile(`${c.file}.json`, 'utf8')) as WhisperJson
    segments.push(...parseWhisperJson(json, opts.speaker, c.offset))
  }
  return segments
}
