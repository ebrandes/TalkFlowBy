import { existsSync } from 'node:fs'
import { mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { dict, type Lang } from '../../shared/i18n'
import type { MeetingMeta, PipelineStatus, Segment, Speaker, Summary, Track } from '../../shared/types'
import type { SummarizeOptions } from './summarize'
import { summarize } from './summarize'
import { meetingRelPath, uniqueName } from './filename'
import { fireworksPaths } from '../setup/binaries'
import { mermaid, renderWithFireworks, usableFlow } from './flow'
import { buildMeetingMarkdown, type FlowBlock } from './markdown'
import { mergeTracks, turnsToPlainText } from './merge'
import { cutChunks, detectSpeech } from './chunks'
import { peakVolumeDb, toWav16k } from './transcode'
import { transcribe } from './whisper'
import { markDone, markProcessing } from '../recovery'

/** Abaixo disso a trilha é silêncio (ninguém falou daquele lado). */
const SILENCE_DB = -50

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
  model: string
  greedy?: boolean
  language: string
  keepAudio: boolean
  /** Desenhar o fluxo no fim da nota quando houver um. */
  drawFlows?: boolean
  summary: SummarizeOptions
  onStatus: (s: PipelineStatus) => void
}

const TRACKS: { track: Track; speaker: Speaker }[] = [
  { track: 'mic', speaker: 'Você' },
  { track: 'system', speaker: 'Outros' }
]

async function hasAudio(file: string): Promise<boolean> {
  if (!existsSync(file)) return false
  if ((await stat(file)).size < 2048) return false
  return (await peakVolumeDb(file)) > SILENCE_DB
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
  const ready: { wav: string; speaker: Speaker }[] = []
  for (const { track, speaker } of TRACKS) {
    const src = join(input.sessionDir, `${track}.webm`)
    if (!(await hasAudio(src))) continue
    const wav = join(input.sessionDir, `${track}.wav`)
    await toWav16k(src, wav)
    ready.push({ wav, speaker })
  }

  const prepared: { speaker: Speaker; chunks: { file: string; offset: number }[] }[] = []
  for (const item of ready) {
    const intervals = await detectSpeech(item.wav)
    const files = await cutChunks(item.wav, intervals, input.sessionDir, item.speaker === 'Você' ? 'mic' : 'system')
    prepared.push({ speaker: item.speaker, chunks: files.map((file, i) => ({ file, offset: intervals[i].start })) })
  }

  const total = prepared.reduce((n, p) => n + p.chunks.length, 0) || 1
  let before = 0
  const segments: Record<Speaker, Segment[]> = { Você: [], Outros: [] }
  for (const item of prepared) {
    onStatus({ stage: 'transcribing', progress: before / total })
    segments[item.speaker] = await transcribe({
      binary: deps.whisper,
      model: deps.model,
      chunks: item.chunks,
      speaker: item.speaker,
      language: deps.language,
      greedy: deps.greedy,
      onProgress: (f) => onStatus({ stage: 'transcribing', progress: (before + f * item.chunks.length) / total })
    })
    before += item.chunks.length
  }
  const turns = mergeTracks(segments['Você'], segments['Outros'])

  let summary: Summary | null = null
  let warning: string | undefined
  if (turns.length > 0) {
    onStatus({ stage: 'summarizing' })
    try {
      summary = await summarize(turnsToPlainText(turns, { Você: t.doc.you, Outros: t.doc.others }), deps.summary)
    } catch (err) {
      warning = `Summary not generated: ${(err as Error).message}`
    }
  }

  onStatus({ stage: 'saving' })
  const assunto = summary?.assunto || t.doc.fileSubject
  const timeSep = deps.lang === 'pt' ? 'h' : '.'
  const rel = uniqueName(meetingRelPath(input.meta.startedAt, assunto, deps.meetingsFolder, timeSep), (p) => existsSync(join(deps.rootDir, p)))
  const full = join(deps.rootDir, rel)
  await mkdir(dirname(full), { recursive: true })
  const flow = deps.drawFlows === false ? undefined : await drawFlow(summary, full, meeting, deps.lang)
  await writeFile(full, buildMeetingMarkdown(input.meta, summary, turns, t.doc, flow), 'utf8')

  if (deps.keepAudio) await markDone(input.sessionDir, rel)
  else await rm(input.sessionDir, { recursive: true, force: true })
  onStatus({ stage: 'done', notePath: rel, message: warning })
  return rel
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
