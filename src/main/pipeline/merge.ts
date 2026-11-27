import type { Segment, Turn } from '../../shared/types'

/** Turno muito longo vira dois parágrafos para não gerar linha gigante no .md. */
const MAX_TURN_CHARS = 900
/** Silêncio longo da mesma pessoa abre um parágrafo novo. */
const MAX_GAP_SEC = 45

const clean = (text: string): string => text.replace(/\s+/g, ' ').trim()

/** Trechos que o Whisper costuma inventar no silêncio. */
const NOISE = /^(\[.*\]|\(.*\)|obrigad[oa]\.?|legendas? .*|tchau\.?)$/i

/**
 * O Whisper às vezes entra em laço em áudio ruim ("que é que é que é..."). Uma sequência de
 * 1 a 6 palavras repetida 3 vezes ou mais em seguida vira uma só.
 */
export function collapseRepeats(text: string): string {
  const words = clean(text).split(' ')
  const out: string[] = []
  let i = 0
  while (i < words.length) {
    let skipped = false
    for (let n = 6; n >= 1 && !skipped; n--) {
      const unit = words.slice(i, i + n).join(' ').toLowerCase()
      if (words.length - i < n * 3) continue
      let reps = 1
      while (words.slice(i + reps * n, i + (reps + 1) * n).join(' ').toLowerCase() === unit) reps++
      if (reps >= 3) {
        out.push(...words.slice(i, i + n))
        i += reps * n
        skipped = true
      }
    }
    if (!skipped) out.push(words[i++])
  }
  return out.join(' ')
}

export function isNoise(text: string): boolean {
  const t = clean(text)
  return t.length === 0 || NOISE.test(t)
}

const words = (text: string): string[] =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1)

/** Quanto dois textos dividem de palavras (0 a 1), pela menor das duas falas. */
export function overlapRatio(a: string, b: string): number {
  const wa = words(a)
  const wb = new Set(words(b))
  if (wa.length === 0 || wb.size === 0) return 0
  const common = new Set(wa.filter((w) => wb.has(w))).size
  return common / Math.min(new Set(wa).size, wb.size)
}

/** Quanto antes ou depois o eco pode aparecer em relação à fala original. */
const ECHO_WINDOW_SEC = 3
const ECHO_SIMILARITY = 0.6

/**
 * Sem fone, o microfone capta a voz dos outros saindo do alto-falante, e a mesma frase aparecia
 * duas vezes ("Você" e "Outros"). Descarta do microfone o trecho quase igual a um do sistema no
 * mesmo momento.
 */
export function dropEcho(mic: Segment[], system: Segment[]): Segment[] {
  if (system.length === 0) return mic
  return mic.filter((m) => {
    // Fala curta ("sim", "beleza") pode ser resposta de verdade: fica.
    if (new Set(words(m.text)).size < 4) return true
    const near = system.filter((s) => s.start <= m.end + ECHO_WINDOW_SEC && s.end >= m.start - ECHO_WINDOW_SEC)
    if (near.length === 0) return true
    const around = near.map((s) => s.text).join(' ')
    return overlapRatio(m.text, around) < ECHO_SIMILARITY
  })
}

/**
 * Intercala as duas trilhas pelo tempo e agrupa falas seguidas da mesma pessoa.
 * Não mexe nas palavras; só ordena, limpa espaços e junta.
 */
export function mergeTracks(mic: Segment[], system: Segment[]): Turn[] {
  const all = [...dropEcho(mic, system), ...system]
    .filter((s) => !isNoise(s.text))
    .sort((a, b) => a.start - b.start || (a.speaker === 'Você' ? -1 : 1))

  const turns: Turn[] = []
  let lastEnd = 0
  for (const seg of all) {
    const text = collapseRepeats(seg.text)
    const prev = turns[turns.length - 1]
    const sameSpeaker = prev && prev.speaker === seg.speaker && prev.voice === seg.voice
    const shortGap = seg.start - lastEnd <= MAX_GAP_SEC
    const fits = prev && prev.text.length + text.length < MAX_TURN_CHARS
    if (sameSpeaker && shortGap && fits) {
      prev.text = `${prev.text} ${text}`
    } else {
      turns.push(seg.voice ? { speaker: seg.speaker, voice: seg.voice, start: seg.start, text } : { speaker: seg.speaker, start: seg.start, text })
    }
    lastEnd = Math.max(lastEnd, seg.end)
  }
  return turns
}

/** Nome de quem falou: "Você", "Outros" ou "Outros 2" quando as vozes foram separadas. */
export function speakerLabel(t: Pick<Turn, 'speaker' | 'voice'>, labels: Record<Turn['speaker'], string>): string {
  return t.voice ? `${labels[t.speaker]} ${t.voice}` : labels[t.speaker]
}

/** Texto corrido para mandar ao modelo de resumo. */
export function turnsToPlainText(turns: Turn[], labels: Record<Turn['speaker'], string> = { Você: 'Você', Outros: 'Outros' }): string {
  return turns.map((t) => `[${formatClock(t.start)}] ${speakerLabel(t, labels)}: ${t.text}`).join('\n')
}

export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}
