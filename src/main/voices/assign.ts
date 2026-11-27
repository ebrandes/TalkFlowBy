import type { Segment } from '../../shared/types'

/** Trecho em que uma voz falou, como sai da separação de vozes. */
export interface VoiceTurn {
  start: number
  end: number
  speaker: number
}

/** Fala sem sobreposição com nenhuma voz: vale a voz mais próxima até esta distância. */
const NEAR_SEC = 1.5
/** Voz que falou menos que isso (e menos de 20% do total) é ruído ou eco; as falas dela vão para a voz vizinha. */
const MIN_VOICE_SEC = 4
const MIN_VOICE_SHARE = 0.2

const overlap = (a: { start: number; end: number }, b: { start: number; end: number }): number =>
  Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start))

function voiceOf(seg: Segment, turns: VoiceTurn[]): number | null {
  const time = new Map<number, number>()
  for (const t of turns) {
    const o = overlap(seg, t)
    if (o > 0) time.set(t.speaker, (time.get(t.speaker) ?? 0) + o)
  }
  if (time.size) return [...time.entries()].sort((a, b) => b[1] - a[1])[0][0]
  let best: { speaker: number; gap: number } | null = null
  for (const t of turns) {
    const gap = Math.max(t.start - seg.end, seg.start - t.end)
    if (gap <= NEAR_SEC && (!best || gap < best.gap)) best = { speaker: t.speaker, gap }
  }
  return best?.speaker ?? null
}

/**
 * Marca cada fala de "Outros" com o número da voz (1, 2, 3… na ordem em que aparecem).
 * Se só uma voz for encontrada, devolve as falas como estavam: fica só "Outros".
 */
export function assignVoices(segments: Segment[], turns: VoiceTurn[]): Segment[] {
  if (!turns.length || !segments.length) return segments
  const raw = segments.map((s) => voiceOf(s, turns))

  // Tempo de fala de cada voz, para descartar as que quase não falaram.
  const spoken = new Map<number, number>()
  raw.forEach((v, i) => {
    if (v !== null) spoken.set(v, (spoken.get(v) ?? 0) + segments[i].end - segments[i].start)
  })
  const total = [...spoken.values()].reduce((a, b) => a + b, 0)
  const kept = new Set([...spoken].filter(([, sec]) => sec >= MIN_VOICE_SEC || sec >= total * MIN_VOICE_SHARE).map(([v]) => v))
  if (kept.size < 2) return segments

  // Fala sem voz conhecida fica com a voz da fala anterior (ou da seguinte, no começo).
  const fixed: (number | null)[] = raw.map((v) => (v !== null && kept.has(v) ? v : null))
  for (let i = 1; i < fixed.length; i++) if (fixed[i] === null) fixed[i] = fixed[i - 1]
  for (let i = fixed.length - 2; i >= 0; i--) if (fixed[i] === null) fixed[i] = fixed[i + 1]

  const order = new Map<number, number>()
  const sorted = segments.map((s, i) => ({ s, v: fixed[i] })).sort((a, b) => a.s.start - b.s.start)
  for (const { v } of sorted) if (v !== null && !order.has(v)) order.set(v, order.size + 1)
  if (order.size < 2) return segments
  return segments.map((s, i) => (fixed[i] === null ? s : { ...s, voice: order.get(fixed[i]!)! }))
}
