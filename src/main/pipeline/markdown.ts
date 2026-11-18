import type { MeetingMeta, Summary, Turn } from '../../shared/types'
import { formatClock } from './merge'

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

/** Evita que o começo da linha vire título, lista ou citação sem querer. */
function escapeLineStart(text: string): string {
  return text.replace(/^(#{1,6}\s|>|[-+=]\s|\d+[.)]\s)/, '\\$1')
}

const line = (text: string): string => escapeLineStart(escapeInline(text))

function yamlValue(value: string): string {
  return /^[\w .,()-]+$/u.test(value) ? value : JSON.stringify(value)
}

function frontmatter(meta: MeetingMeta): string[] {
  const out = ['---', `data: ${formatDateTime(meta.startedAt)}`, `duracao: ${formatDuration(meta.durationSec)}`]
  if (meta.origin) out.push(`origem: ${yamlValue(meta.origin)}`)
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

function transcriptBlock(turns: Turn[]): string[] {
  const out: string[] = []
  for (const t of turns) out.push(`**[${formatClock(t.start)}] ${t.speaker}:** ${escapeInline(t.text)}`, '')
  if (out[out.length - 1] === '') out.pop()
  return out
}

function quote(text: string): string[] {
  const sentences = escapeInline(text)
  return sentences ? [`> ${sentences}`] : []
}

/** Monta a nota da reunião. O formato é fixo; o modelo só fornece o conteúdo. */
export function buildMeetingMarkdown(meta: MeetingMeta, summary: Summary | null, turns: Turn[]): string {
  const title = summary?.assunto.trim() || 'Reunião sem assunto'
  const parts: string[] = [...frontmatter(meta), '', `# ${escapeInline(title)}`, '']

  if (summary) {
    const resumo = quote(summary.resumo)
    if (resumo.length) parts.push(...resumo, '')
    parts.push(...section('Tópicos', topicsBlock(summary)))
    parts.push(...section('Decisões', summary.decisoes.filter((d) => d.trim()).map((d) => `- ${escapeInline(d)}`)))
    parts.push(...section('Próximos passos', tasksBlock(summary)))
  } else {
    parts.push('> O resumo não foi gerado. A transcrição completa está abaixo.', '')
  }

  parts.push(...section('Transcrição', transcriptBlock(turns)))
  if (turns.length === 0) parts.push('## Transcrição', '', 'Nenhuma fala foi reconhecida nesta gravação.', '')

  while (parts[parts.length - 1] === '') parts.pop()
  return `${parts.join('\n')}\n`
}
