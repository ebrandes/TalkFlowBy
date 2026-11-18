import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import type { Turn } from '../../shared/types'
import { formatClock } from './merge'

/** Captura de tela feita durante a gravação, com caminhos relativos à pasta da gravação. */
export interface Shot {
  file: string
  /** Versão menor, a que vai para o resumo. */
  small: string
  /** Segundo da reunião (sem as pausas) em que foi feita. */
  offsetSec: number
}

/** Captura já copiada para perto da nota, pronta para entrar no markdown. */
export interface PlacedShot {
  /** Caminho relativo à nota, já codificado para o link do markdown. */
  link: string
  offsetSec: number
  index: number
}

/** Até quantas telas vão para o resumo; com mais, escolhe espalhadas pela reunião. */
export const MAX_SUMMARY_SHOTS = 12

export async function readShots(sessionDir: string): Promise<Shot[]> {
  const file = join(sessionDir, 'shots.json')
  if (!existsSync(file)) return []
  try {
    const list = JSON.parse(await readFile(file, 'utf8')) as Shot[]
    return list.filter((s) => s && typeof s.file === 'string' && existsSync(join(sessionDir, s.file))).sort((a, b) => a.offsetSec - b.offsetSec)
  } catch {
    return []
  }
}

/** Link de markdown seguro para nomes com espaço e parênteses. */
export function encodeLink(path: string): string {
  return encodeURI(path).replace(/\(/g, '%28').replace(/\)/g, '%29')
}

/** Rótulo que liga a imagem ao trecho: "Tela 2 · 12:30". */
export function shotLabel(word: string, index: number, offsetSec: number): string {
  return `${word} ${index} · ${formatClock(offsetSec)}`
}

/**
 * Copia as capturas para uma pasta ao lado da nota ("<nota> - telas/tela-01.jpg"),
 * para a nota continuar com as imagens depois que a pasta da gravação for apagada.
 */
export async function placeShots(shots: Shot[], sessionDir: string, notePath: string, folderWord: string, fileWord: string): Promise<PlacedShot[]> {
  if (shots.length === 0) return []
  const folder = `${basename(notePath, '.md')} - ${folderWord}`
  await mkdir(join(dirname(notePath), folder), { recursive: true })
  const placed: PlacedShot[] = []
  for (const [i, s] of shots.entries()) {
    const name = `${fileWord}-${String(i + 1).padStart(2, '0')}.jpg`
    await copyFile(join(sessionDir, s.file), join(dirname(notePath), folder, name))
    placed.push({ link: encodeLink(`${folder}/${name}`), offsetSec: s.offsetSec, index: i + 1 })
  }
  return placed
}

/** Até `max` capturas, espalhadas pela reunião (sempre a primeira e a última). */
export function pickForSummary<T>(shots: T[], max = MAX_SUMMARY_SHOTS): T[] {
  if (shots.length <= max) return shots
  const step = (shots.length - 1) / (max - 1)
  return Array.from({ length: max }, (_, i) => shots[Math.round(i * step)])
}

/**
 * Texto da transcrição para o resumo, com uma linha "[Tela 2 · 12:30]" onde cada captura foi feita,
 * para o modelo saber o que estava na tela naquele momento da conversa.
 */
export function plainTextWithShots(turns: Turn[], labels: Record<Turn['speaker'], string>, marks: { label: string; offsetSec: number }[]): string {
  const lines: string[] = []
  let m = 0
  for (const t of turns) {
    while (m < marks.length && marks[m].offsetSec <= t.start) lines.push(`[${marks[m++].label}]`)
    lines.push(`[${formatClock(t.start)}] ${labels[t.speaker]}: ${t.text}`)
  }
  while (m < marks.length) lines.push(`[${marks[m++].label}]`)
  return lines.join('\n')
}
