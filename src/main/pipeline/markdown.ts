import type { Dict } from '../../shared/i18n'
import { pt } from '../../shared/i18n/pt'
import type { MeetingMeta, Summary, Turn } from '../../shared/types'
import { formatClock, speakerLabel } from './merge'

const pad = (n: number): string => String(n).padStart(2, '0')

export function formatDateTime(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatDuration(totalSec: number): string {
  const min = Math.max(1, Math.round(totalSec / 60))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const rest = min % 60
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`
}

/** Escapa o que mudaria o sentido do texto no markdown, sem poluir o texto comum. */
export function escapeInline(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/([\\`*[\]<])/g, '\\$1')
    .replace(/(^|\s)_|_(?=\s|$)/g, (m) => m.replace('_', '\\_'))
}

function yamlValue(value: string): string {
  return /^[\w .,()-]+$/u.test(value) ? value : JSON.stringify(value)
}

type Doc = Dict['doc']

function frontmatter(meta: MeetingMeta, d: Doc): string[] {
  const k = d.keys
  const out = ['---', `${k.date}: ${formatDateTime(meta.startedAt)}`, `${k.duration}: ${formatDuration(meta.durationSec)}`]
  if (meta.origin) out.push(`${k.source}: ${yamlValue(meta.origin)}`)
  out.push('---')
  return out
}

function section(title: string, body: string[]): string[] {
  return body.length === 0 ? [] : [`## ${title}`, '', ...body, '']
}

function topicsBlock(summary: Summary): string[] {
  const out: string[] = []
  for (const topic of summary.topicos) {
    const points = topic.pontos.filter((p) => p.trim())
    if (!topic.titulo.trim() && points.length === 0) continue
    if (topic.titulo.trim()) out.push(`### ${escapeInline(topic.titulo)}`, '')
    if (points.length) out.push(...points.map((p) => `- ${escapeInline(p)}`), '')
  }
  if (out[out.length - 1] === '') out.pop()
  return out
}

function tasksBlock(summary: Summary): string[] {
  return summary.tarefas
    .filter((t) => t.tarefa.trim())
    .map((t) => {
      const who = t.responsavel?.trim() ? ` — ${escapeInline(t.responsavel)}` : ''
      return `- [ ] ${escapeInline(t.tarefa)}${who}`
    })
}

/** Captura de tela para a nota: link relativo e o momento da reunião. */
export interface NoteShot {
  link: string
  label: string
  offsetSec: number
}

const image = (s: NoteShot): string => `![${escapeInline(s.label)}](${s.link})`

/** Transcrição com cada captura no ponto da conversa em que foi feita. */
function transcriptBlock(turns: Turn[], d: Doc, shots: NoteShot[] = []): string[] {
  const out: string[] = []
  const labels = { Você: d.you, Outros: d.others }
  let m = 0
  for (const t of turns) {
    while (m < shots.length && shots[m].offsetSec <= t.start) out.push(image(shots[m++]), '')
    // Sem colchetes no horário: o editor escaparia "[00:00]" como "\[00:00]" ao salvar.
    out.push(`**${formatClock(t.start)} · ${speakerLabel(t, labels)}:** ${escapeInline(t.text)}`, '')
  }
  while (m < shots.length) out.push(image(shots[m++]), '')
  if (out[out.length - 1] === '') out.pop()
  return out
}

function quote(text: string): string[] {
  const sentences = escapeInline(text)
  return sentences ? [`> ${sentences}`] : []
}

/** Fluxo no fim da nota: a imagem desenhada, ou o Mermaid quando não deu para desenhar. */
export interface FlowBlock {
  image?: string
  mermaid?: string
}

export function flowSection(flow: FlowBlock | undefined, d: Doc): string[] {
  if (!flow?.image && !flow?.mermaid) return []
  const body = flow.image ? [`![${d.flowImage}](${encodeURI(flow.image)})`] : ['```mermaid', flow.mermaid!, '```']
  return [`## ${d.flow}`, '', ...body, '']
}

/** O bloco do resumo, entre o título e a transcrição. */
export function summaryParts(summary: Summary | null, d: Doc): string[] {
  if (!summary) return [`> ${d.noSummary}`, '']
  const parts: string[] = []
  const resumo = quote(summary.resumo)
  if (resumo.length) parts.push(...resumo, '')
  parts.push(...section(d.topics, topicsBlock(summary)))
  parts.push(...section(d.decisions, summary.decisoes.filter((x) => x.trim()).map((x) => `- ${escapeInline(x)}`)))
  parts.push(...section(d.nextSteps, tasksBlock(summary)))
  return parts
}

/** Monta a nota da reunião. O formato é fixo; o modelo só fornece o conteúdo. */
export function buildMeetingMarkdown(meta: MeetingMeta, summary: Summary | null, turns: Turn[], d: Doc = pt.doc, flow?: FlowBlock, shots: NoteShot[] = []): string {
  const title = summary?.assunto.trim() || d.untitled
  const parts: string[] = [...frontmatter(meta, d), '', `# ${escapeInline(title)}`, '']

  parts.push(...summaryParts(summary, d))

  if (turns.length > 0) parts.push(...section(d.transcript, transcriptBlock(turns, d, shots)))
  else {
    parts.push(`## ${d.transcript}`, '', d.noSpeech, '')
    if (shots.length) parts.push(...transcriptBlock([], d, shots), '')
  }
  parts.push(...flowSection(flow, d))

  while (parts[parts.length - 1] === '') parts.pop()
  return `${parts.join('\n')}\n`
}
