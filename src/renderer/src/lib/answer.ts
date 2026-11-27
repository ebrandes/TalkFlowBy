import type { AskResult } from '../../../shared/types'

// Markdown curto da resposta do Haiku, em blocos simples. Sem HTML: só texto, listas, títulos e código.

export type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'code'; text: string }

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'strong'; text: string }
  | { kind: 'em'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string; href: string }
  | { kind: 'cite'; id: number }

const BULLET = /^\s*[-*•]\s+(.*)$/
const NUMBER = /^\s*\d+[.)]\s+(.*)$/

export function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const out: Block[] = []
  let para: string[] = []
  const flush = (): void => {
    if (para.length) out.push({ kind: 'paragraph', text: para.join(' ').trim() })
    para = []
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*```/.test(line)) {
      flush()
      const code: string[] = []
      while (++i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i])
      out.push({ kind: 'code', text: code.join('\n') })
      continue
    }
    const h = /^\s*#{1,6}\s+(.*)$/.exec(line)
    if (h) {
      flush()
      out.push({ kind: 'heading', text: h[1].trim() })
      continue
    }
    const b = BULLET.exec(line) ?? NUMBER.exec(line)
    if (b) {
      flush()
      const ordered = !BULLET.test(line)
      const last = out[out.length - 1]
      if (last?.kind === 'list' && last.ordered === ordered) last.items.push(b[1].trim())
      else out.push({ kind: 'list', ordered, items: [b[1].trim()] })
      continue
    }
    if (!line.trim()) {
      flush()
      continue
    }
    // Linha que continua o item anterior da lista (recuada).
    const last = out[out.length - 1]
    if (para.length === 0 && last?.kind === 'list' && /^\s{2,}\S/.test(line)) {
      last.items[last.items.length - 1] += ` ${line.trim()}`
      continue
    }
    para.push(line.trim())
  }
  flush()
  return out
}

const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[\d{1,3}\])|(\[[^\]]+\]\((https?:\/\/[^)\s]+)\))|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g

export function parseInline(text: string): Inline[] {
  const out: Inline[] = []
  let at = 0
  for (const m of text.matchAll(INLINE)) {
    if (m.index > at) out.push({ kind: 'text', text: text.slice(at, m.index) })
    const tok = m[0]
    if (m[1]) out.push({ kind: 'code', text: tok.slice(1, -1) })
    else if (m[2]) out.push({ kind: 'strong', text: tok.slice(2, -2) })
    else if (m[3]) out.push({ kind: 'cite', id: Number(tok.slice(1, -1)) })
    else if (m[4]) out.push({ kind: 'link', text: tok.slice(1, tok.indexOf('](')), href: m[5] })
    else out.push({ kind: 'em', text: tok.slice(1, -1) })
    at = m.index + tok.length
  }
  if (at < text.length) out.push({ kind: 'text', text: text.slice(at) })
  return out
}

/** Título legível de uma nota a partir do caminho. */
export function noteTitle(path: string): string {
  return path.split('/').pop()!.replace(/\.md$/i, '')
}

/** Resposta para colar em outro lugar: citações viram os nomes das notas. */
export function toMarkdown(result: AskResult): string {
  const body = result.answer.replace(/\[(\d{1,3})\]/g, (all, n: string) => {
    const path = result.notes[Number(n) - 1]
    return path ? `[${noteTitle(path)}]` : all
  })
  return body.replace(/\]\[/g, '] [')
}

/** Caminho da nota (relativo à raiz) para um link .md relativo dentro de `from`; nulo se não for link de nota. */
export function noteFromLink(from: string, href: string): string | null {
  if (!href || /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('#')) return null
  let path: string
  try {
    path = decodeURIComponent(href.split('#')[0])
  } catch {
    return null
  }
  if (!/\.md$/i.test(path)) return null
  const parts = path.startsWith('/') ? [] : from.split('/').slice(0, -1)
  for (const seg of path.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') {
      if (!parts.length) return null
      parts.pop()
    } else parts.push(seg)
  }
  return parts.join('/')
}
