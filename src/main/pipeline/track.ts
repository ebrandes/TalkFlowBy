import { existsSync } from 'node:fs'
import { readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Segment, Speaker, Track } from '../../shared/types'
import { analyzeSpeech, cutChunks, type Interval } from './chunks'
import { toWav16k } from './transcode'

/** Abaixo disso a trilha é silêncio (ninguém falou daquele lado). */
export const SILENCE_DB = -50
/**
 * Durante a reunião, só entra o trecho de fala que terminou pelo menos este tempo antes do fim
 * do que já foi gravado; a fala ainda em curso fica para a próxima rodada.
 */
export const LIVE_MARGIN_SEC = 3

export const TRACKS: { track: Track; speaker: Speaker }[] = [
  { track: 'mic', speaker: 'Você' },
  { track: 'system', speaker: 'Outros' }
]

/** O que já foi transcrito de uma trilha durante a reunião, salvo na pasta da gravação. */
export interface TrackProgress {
  /** Segundo da trilha até onde já foi transcrito. */
  doneSec: number
  segments: Segment[]
}

export const liveFile = (dir: string, track: Track): string => join(dir, `live-${track}.json`)

export async function readProgress(dir: string, track: Track): Promise<TrackProgress | null> {
  try {
    const p = JSON.parse(await readFile(liveFile(dir, track), 'utf8')) as TrackProgress
    return typeof p.doneSec === 'number' && Array.isArray(p.segments) ? p : null
  } catch {
    return null
  }
}

/** Grava num arquivo ao lado e troca de nome, para uma queda no meio não deixar o JSON pela metade. */
export async function writeProgress(dir: string, track: Track, p: TrackProgress): Promise<void> {
  const file = liveFile(dir, track)
  await writeFile(`${file}.tmp`, JSON.stringify(p))
  await rename(`${file}.tmp`, file)
}

export interface PreparedRange {
  chunks: { file: string; offset: number }[]
  /** Até onde a trilha fica transcrita depois destes trechos. */
  doneSec: number
}

/**
 * Escolhe os trechos de fala que podem ser transcritos agora. No fim da reunião, todos.
 * Durante, só os que já terminaram, e o ponto de parada avança para não reler silêncio.
 */
export function pickIntervals(intervals: Interval[], duration: number, final: boolean): { take: Interval[]; doneRel: number } {
  if (final) return { take: intervals, doneRel: duration }
  const limit = duration - LIVE_MARGIN_SEC
  const take = intervals.filter((iv) => iv.end < limit)
  if (take.length) return { take, doneRel: take[take.length - 1].end }
  const open = intervals.find((iv) => iv.end >= limit)
  return { take, doneRel: Math.max(0, open ? open.start : limit) }
}

/** webm → wav a partir de `fromSec`, acha a fala e corta em trechos prontos para o Whisper. */
export async function prepareRange(dir: string, track: Track, fromSec: number, final: boolean): Promise<PreparedRange> {
  const src = join(dir, `${track}.webm`)
  const none = { chunks: [], doneSec: fromSec }
  if (!existsSync(src) || (await stat(src)).size < 2048) return none
  const wav = join(dir, final ? `${track}.wav` : `${track}.live.wav`)
  await toWav16k(src, wav, fromSec)
  try {
    const a = await analyzeSpeech(wav)
    if (final && a.peakDb <= SILENCE_DB) return { chunks: [], doneSec: fromSec + a.duration }
    const { take, doneRel } = pickIntervals(a.intervals, a.duration, final)
    const prefix = `${track}-${Math.round(fromSec * 1000)}`
    const files = await cutChunks(wav, take, dir, prefix)
    return { chunks: files.map((file, i) => ({ file, offset: fromSec + take[i].start })), doneSec: fromSec + doneRel }
  } finally {
    if (!final) await rm(wav, { force: true })
  }
}

/** Apaga os trechos cortados e o JSON que o Whisper deixou ao lado de cada um. */
export async function removeChunks(chunks: { file: string }[]): Promise<void> {
  await Promise.all(chunks.flatMap((c) => [rm(c.file, { force: true }), rm(`${c.file}.json`, { force: true })]))
}
