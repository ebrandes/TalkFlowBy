import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { ffmpegPath } from '../setup/binaries'

export interface Interval {
  start: number
  end: number
}

/** Silêncio mais curto que isso não separa falas (pausa normal de respiração). */
const MIN_SILENCE_SEC = 0.8
/** Trechos com voz mais próximos que isso viram um só. */
const JOIN_GAP_SEC = 1.2
/** Trecho com voz mais curto que isso é estalo, tosse ou clique. */
const MIN_SPEECH_SEC = 0.5
/** Folga nas pontas para não cortar a primeira e a última sílaba. */
const PAD_SEC = 0.25

/**
 * Lê a saída do `silencedetect` do ffmpeg e devolve os trechos com voz.
 * Transcrever só esses trechos evita que o Whisper invente frases no silêncio
 * e mantém o horário de cada fala certo.
 */
export function speechIntervals(ffmpegStderr: string, duration: number): Interval[] {
  const silences: Interval[] = []
  let openStart: number | null = null
  for (const line of ffmpegStderr.split('\n')) {
    const s = line.match(/silence_start:\s*(-?[\d.]+)/)
    if (s) openStart = Math.max(0, Number(s[1]))
    const e = line.match(/silence_end:\s*([\d.]+)/)
    if (e && openStart !== null) {
      silences.push({ start: openStart, end: Number(e[1]) })
      openStart = null
    }
  }
  if (openStart !== null) silences.push({ start: openStart, end: duration })

  const speech: Interval[] = []
  let cursor = 0
  for (const sil of silences) {
    if (sil.start > cursor) speech.push({ start: cursor, end: sil.start })
    cursor = Math.max(cursor, sil.end)
  }
  if (cursor < duration) speech.push({ start: cursor, end: duration })

  const joined: Interval[] = []
  for (const iv of speech) {
    const last = joined[joined.length - 1]
    if (last && iv.start - last.end < JOIN_GAP_SEC) last.end = iv.end
    else joined.push({ ...iv })
  }
  return joined
    .filter((iv) => iv.end - iv.start >= MIN_SPEECH_SEC)
    .map((iv) => ({ start: Math.max(0, iv.start - PAD_SEC), end: Math.min(duration, iv.end + PAD_SEC) }))
}

function runFfmpeg(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath(), args, { windowsHide: true })
    let err = ''
    child.stderr.on('data', (d) => (err += d))
    child.on('error', reject)
    child.on('close', (code) => (code === 0 ? resolve(err) : reject(new Error(`ffmpeg falhou: ${err.slice(-400)}`))))
  })
}

export async function detectSpeech(wav: string): Promise<Interval[]> {
  const stderr = await runFfmpeg(['-hide_banner', '-i', wav, '-af', `silencedetect=noise=-38dB:d=${MIN_SILENCE_SEC}`, '-f', 'null', '-'])
  const d = stderr.match(/Duration:\s*(\d+):(\d+):([\d.]+)/)
  const duration = d ? Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]) : 0
  return speechIntervals(stderr, duration)
}

/** Corta cada trecho com voz num wav próprio. Devolve os caminhos na mesma ordem. */
export async function cutChunks(wav: string, intervals: Interval[], dir: string, prefix: string): Promise<string[]> {
  const files: string[] = []
  for (const [i, iv] of intervals.entries()) {
    const out = join(dir, `${prefix}-${String(i).padStart(4, '0')}.wav`)
    await runFfmpeg(['-y', '-v', 'error', '-ss', iv.start.toFixed(3), '-to', iv.end.toFixed(3), '-i', wav, '-c', 'copy', out])
    files.push(out)
  }
  return files
}
