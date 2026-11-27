import { DICTS, type Dict } from '../../shared/i18n'
import type { Summary } from '../../shared/types'
import { mermaid, usableFlow } from './flow'
import { escapeInline, flowSection, summaryParts } from './markdown'

/** Partes de uma nota de reunião: cabeçalho, título, resumo, transcrição e o que vem depois. */
export interface MeetingNoteParts {
  front: string
  title: string
  transcript: string
  /** Seções depois da transcrição (o fluxo), mantidas como estão. */
  after: string
  doc: Dict['doc']
}

/** Acha o título e a seção da transcrição, em português ou inglês. */
export function splitMeetingNote(md: string): MeetingNoteParts | null {
  const fm = md.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/)
  const front = fm ? fm[0] : ''
  const body = md.slice(front.length)
  for (const d of Object.values(DICTS).map((x) => x.doc)) {
    const head = new RegExp(`^## ${d.transcript}\\s*$`, 'm').exec(body)
    if (!head) continue
    const titleMatch = /^# (.+)$/m.exec(body.slice(0, head.index))
    const rest = body.slice(head.index + head[0].length)
    const next = /^## /m.exec(rest)
    return {
      front,
      title: titleMatch ? titleMatch[1].trim() : d.untitled,
      transcript: (next ? rest.slice(0, next.index) : rest).trim(),
      after: next ? rest.slice(next.index).trim() : '',
      doc: d
    }
  }
  return null
}

/** A transcrição da nota em texto simples para o modelo: sem imagens nem negrito. */
export function transcriptForSummary(transcript: string): string {
  return transcript
    .split(/\r?\n/)
    .filter((l) => l.trim() && !/^!\[/.test(l.trim()))
    .map((l) => l.replace(/\*\*/g, '').replace(/\\([\\`*[\]<_])/g, '$1'))
    .join('\n')
}

/**
 * Reescreve a nota com um resumo novo, mantendo cabeçalho, transcrição e capturas.
 * O título só muda se a nota ainda não tinha assunto.
 */
export function rebuildWithSummary(parts: MeetingNoteParts, summary: Summary, drawFlow = true): string {
  const d = parts.doc
  const keepTitle = parts.title && parts.title !== d.untitled
  const title = keepTitle ? parts.title : escapeInline(summary.assunto.trim() || d.untitled)
  const hasFlow = new RegExp(`^## ${d.flow}\\s*$`, 'm').test(parts.after)
  const flow = !hasFlow && drawFlow && usableFlow(summary.fluxo) ? flowSection({ mermaid: mermaid(summary.fluxo) }, d).join('\n').trim() : ''
  const out = [
    parts.front.trimEnd(),
    '',
    `# ${title}`,
    '',
    ...summaryParts(summary, d),
    `## ${d.transcript}`,
    '',
    parts.transcript,
    '',
    parts.after,
    flow
  ]
    .filter((x, i, arr) => !(x === '' && arr[i - 1] === ''))
    .join('\n')
    .replace(/^\n+/, '')
    .trimEnd()
  return `${out}\n`
}
