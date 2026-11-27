import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { dict, type Lang } from '../../shared/i18n'
import type { MeetingMeta, PipelineStatus, Segment, Speaker, Summary } from '../../shared/types'
import type { SummarizeOptions } from './summarize'
import { summarize } from './summarize'
import { meetingRelPath, uniqueName } from './filename'
import { fireworksPaths } from '../setup/binaries'
import { mermaid, renderWithFireworks, usableFlow } from './flow'
import { buildMeetingMarkdown, type FlowBlock } from './markdown'
import { mergeTracks } from './merge'
import { pickForSummary, placeShots, plainTextWithShots, readShots, shotLabel } from './shots'
import { prepareRange, readProgress, removeChunks, TRACKS } from './track'
import { transcribe } from './whisper'
import { toWav16k } from './transcode'
import { assignVoices, type VoiceTurn } from '../voices/assign'
import { markDone, markProcessing } from '../recovery'
import { friendlyError } from '../errors'

export interface RunInput {
  sessionDir: string
  meta: MeetingMeta
}

export interface RunDeps {
  rootDir: string
  /** Idioma das notas (títulos das seções, falantes, nome da pasta). */
  lang: Lang
  meetingsFolder: string
  whisper: string
  /** Whisper só com CPU, se `whisper` for o de GPU. */
  whisperFallback?: string
  model: string
  greedy?: boolean
  language: string
  keepAudio: boolean
  /** Separa as vozes de "Outros" (Outros 1, Outros 2…); sem isso, fica só "Outros". */
  voices?: (wav: string, durationSec: number) => Promise<VoiceTurn[] | null>
  /** Desenhar o fluxo no fim da nota quando houver um. */
  drawFlows?: boolean
  summary: SummarizeOptions
  onStatus: (s: PipelineStatus) => void
}

/** Gravação → wav → Whisper → junção → Haiku → .md. Devolve o caminho relativo da nota. */
export async function processRecording(input: RunInput, deps: RunDeps): Promise<string> {
  const t = dict(deps.lang)
  const d = input.meta.startedAt
  const pad = (n: number): string => String(n).padStart(2, '0')
  const meeting = `${d.getDate()} ${t.months[d.getMonth()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  const onStatus = (s: PipelineStatus): void => deps.onStatus({ ...s, meeting })
  await markProcessing(input.sessionDir)
  onStatus({ stage: 'converting' })
  // As duas trilhas são preparadas ao mesmo tempo; o que já foi transcrito durante a reunião é pulado.
  const prepared = await Promise.all(
    TRACKS.map(async ({ track, speaker }) => {
      const live = await readProgress(input.sessionDir, track)
      const range = await prepareRange(input.sessionDir, track, live?.doneSec ?? 0, true)
      return { speaker, chunks: range.chunks, earlier: live?.segments ?? [] }
    })
  )

  // A separação de vozes roda em paralelo com o Whisper, sobre o áudio inteiro do sistema.
  const voicesJob = deps.voices ? findVoices(input.sessionDir, deps.voices) : Promise.resolve(null)

  const total = prepared.reduce((n, p) => n + p.chunks.length, 0) || 1
  let before = 0
  const segments: Record<Speaker, Segment[]> = { Você: [], Outros: [] }
  for (const item of prepared) {
    onStatus({ stage: 'transcribing', progress: before / total })
    const fresh = await transcribe({
      binary: deps.whisper,
      fallbackBinary: deps.whisperFallback,
      model: deps.model,
      chunks: item.chunks,
      speaker: item.speaker,
      language: deps.language,
      greedy: deps.greedy,
      onProgress: (f) => onStatus({ stage: 'transcribing', progress: (before + f * item.chunks.length) / total })
    })
    segments[item.speaker] = [...item.earlier, ...fresh]
    await removeChunks(item.chunks)
    before += item.chunks.length
  }
  if (deps.voices && segments['Outros'].length) {
    onStatus({ stage: 'voices' })
    const voices = await voicesJob
    if (voices) segments['Outros'] = assignVoices(segments['Outros'], voices)
  }
  const turns = mergeTracks(segments['Você'], segments['Outros'])

  // Capturas de tela: marcadas na transcrição e mandadas junto para o resumo.
  const shots = (await readShots(input.sessionDir)).map((s, i) => ({ ...s, index: i + 1, label: shotLabel(t.doc.screen, i + 1, s.offsetSec) }))
  const forSummary = pickForSummary(shots)

  let summary: Summary | null = null
  let warning: string | undefined
  if (turns.length > 0) {
    onStatus({ stage: 'summarizing' })
    try {
      const text = plainTextWithShots(turns, { Você: t.doc.you, Outros: t.doc.others }, forSummary)
      const images = await Promise.all(forSummary.map(async (s) => ({ label: s.label, jpeg: await readFile(join(input.sessionDir, s.small)) })))
      summary = await summarize(text, deps.summary, images)
    } catch (err) {
      warning = t.errors.summaryNotGenerated(friendlyError(err, t.errors))
    }
  }

  onStatus({ stage: 'saving' })
  const assunto = summary?.assunto || t.doc.fileSubject
  const timeSep = deps.lang === 'pt' ? 'h' : '.'
  const rel = uniqueName(meetingRelPath(input.meta.startedAt, assunto, deps.meetingsFolder, timeSep), (p) => existsSync(join(deps.rootDir, p)))
  const full = join(deps.rootDir, rel)
  await mkdir(dirname(full), { recursive: true })
  const flow = deps.drawFlows === false ? undefined : await drawFlow(summary, full, meeting, deps.lang)
  const placed = await placeShots(shots, input.sessionDir, full, t.doc.screensFolder, t.doc.screen.toLowerCase())
  const noteShots = placed.map((p) => ({ link: p.link, offsetSec: p.offsetSec, label: shotLabel(t.doc.screen, p.index, p.offsetSec) }))
  await writeFile(full, buildMeetingMarkdown(input.meta, summary, turns, t.doc, flow, noteShots), 'utf8')

  if (deps.keepAudio) await markDone(input.sessionDir, rel)
  else await rm(input.sessionDir, { recursive: true, force: true })
  onStatus({ stage: 'done', notePath: rel, message: warning })
  return rel
}

/** Converte o áudio do sistema e separa as vozes. Qualquer falha só deixa a nota com "Outros". */
async function findVoices(dir: string, detect: NonNullable<RunDeps['voices']>): Promise<VoiceTurn[] | null> {
  const src = join(dir, 'system.webm')
  if (!existsSync(src)) return null
  const wav = join(dir, 'voices.wav')
  try {
    await toWav16k(src, wav, 0)
    // wav de 16 kHz, 16 bits, mono: 32 000 bytes por segundo depois do cabeçalho.
    const durationSec = Math.max(0, ((await stat(wav)).size - 44) / 32_000)
    return durationSec < 5 ? null : await detect(wav, durationSec)
  } catch {
    return null
  } finally {
    await rm(wav, { force: true }).catch(() => undefined)
  }
}

/** Desenha o fluxo ao lado da nota com o fireworks-tech-graph; sem a skill, devolve o Mermaid. */
async function drawFlow(summary: Summary | null, notePath: string, when: string, lang: Lang): Promise<FlowBlock | undefined> {
  const fluxo = summary?.fluxo
  if (!usableFlow(fluxo)) return undefined
  const fw = await fireworksPaths()
  if (fw) {
    const svgName = `${basename(notePath, '.md')} - ${lang === 'pt' ? 'fluxo' : 'workflow'}.svg`
    if (await renderWithFireworks(fw.python, fw.script, fluxo, `${summary?.assunto ?? ''} · ${when}`, join(dirname(notePath), svgName))) {
      return { image: svgName }
    }
  }
  return { mermaid: mermaid(fluxo) }
}
