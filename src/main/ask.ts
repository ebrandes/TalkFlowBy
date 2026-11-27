import { readFile, stat } from 'node:fs/promises'
import { relative, sep } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import type { AskResult, SummaryProvider, UiLang } from '../shared/types'
import { resolveInside } from './library'
import { API_MODEL, isolatedCliArgs, run } from './pipeline/summarize'
import { mdFiles } from './search'
import { claudePath } from './setup/binaries'

const CLI_TIMEOUT_MS = 3 * 60_000
/** Cerca de 100 mil tokens de notas: cabe com folga no Haiku e mantém a resposta rápida. */
export const MAX_CONTEXT_CHARS = 400_000

export interface AskOptions {
  provider: SummaryProvider
  apiKey?: string | null
  lang: UiLang
}

export interface NoteDoc {
  path: string
  text: string
}

export const ASK_SYSTEM_PROMPT = `You answer questions about the user's own meeting notes and personal notes, made by the TalkFlowBy app.
Each note arrives inside <note id="N" path="..."> tags. Meeting notes have a summary, topics, decisions, tasks and the transcript.
Rules:
- Answer only from the notes. If they do not hold the answer, say so plainly in one sentence. Never invent names, numbers or links.
- Answer in the language of the question.
- Use short Markdown: a direct answer first, then bullet lists when listing things. No preamble, no closing remarks.
- When you list things (repositories, people, tools, tasks, links, dates), list each distinct item once, with a few words of context.
- Cite the notes you used with their id in square brackets, like [1] or [2][5], right after the statement.
- The transcript comes from automatic speech recognition: names of repositories, products and people may be misspelled. Prefer the spelling used in the summary, and mention it when you are unsure.`

/** Tira o que não ajuda a responder e só gasta espaço: imagens e linhas em branco repetidas. */
export function compactNote(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** A mesma nota sem a seção de transcrição, para quando não cabe tudo. */
export function withoutTranscript(md: string): string {
  return md.replace(/^## (Transcrição|Transcript)\s*$[\s\S]*?(?=^## |(?![\s\S]))/m, '').trim()
}

/**
 * Junta as notas no limite de tamanho: mais recentes primeiro, inteiras enquanto couberem,
 * depois só o resumo (sem a transcrição), e por fim deixa de fora o que sobrar.
 */
export function packNotes(notes: NoteDoc[], budget = MAX_CONTEXT_CHARS): { included: NoteDoc[]; omitted: number; trimmed: number } {
  const included: NoteDoc[] = []
  let used = 0
  let omitted = 0
  let trimmed = 0
  for (const n of notes) {
    const full = compactNote(n.text)
    if (used + full.length <= budget) {
      included.push({ path: n.path, text: full })
      used += full.length
      continue
    }
    const short = withoutTranscript(full)
    if (short.length < full.length && used + short.length <= budget) {
      included.push({ path: n.path, text: short })
      used += short.length
      trimmed++
      continue
    }
    omitted++
  }
  return { included, omitted, trimmed }
}

/** Monta o pedido: as notas marcadas com número e, no fim, a pergunta. */
export function buildAskPrompt(question: string, notes: NoteDoc[]): string {
  const docs = notes.map((n, i) => `<note id="${i + 1}" path="${n.path.replace(/"/g, "'")}">\n${n.text}\n</note>`).join('\n\n')
  return `<notes>\n${docs}\n</notes>\n\nQuestion: ${question.trim()}`
}

/** Números citados na resposta, como [2] ou [1][3], na ordem em que aparecem e sem repetir. */
export function citedIds(answer: string, max: number): number[] {
  const seen = new Set<number>()
  for (const m of answer.matchAll(/\[(\d{1,3})\]/g)) {
    const n = Number(m[1])
    if (n >= 1 && n <= max) seen.add(n)
  }
  return [...seen]
}

/** Lê as notas do escopo pedido: uma só, ou todas da pasta, das mais novas para as mais antigas. */
export async function loadNotes(root: string, path: string | null): Promise<NoteDoc[]> {
  if (path) return [{ path, text: await readFile(resolveInside(root, path), 'utf8') }]
  const files = await mdFiles(root)
  const withTime = await Promise.all(files.map(async (f) => ({ f, t: (await stat(f).catch(() => null))?.mtimeMs ?? 0 })))
  withTime.sort((a, b) => b.t - a.t)
  const out: NoteDoc[] = []
  for (const { f } of withTime) {
    const text = await readFile(f, 'utf8').catch(() => '')
    if (text.trim()) out.push({ path: relative(root, f).split(sep).join('/'), text })
  }
  return out
}

async function askWithCli(prompt: string, claude: string): Promise<string> {
  const args = ['-p', 'Answer the question at the end of the standard input, using the notes before it.', '--model', 'haiku', '--output-format', 'json', ...isolatedCliArgs(ASK_SYSTEM_PROMPT)]
  const stdout = await run(claude, args, prompt, CLI_TIMEOUT_MS, 'The answer took too long and was cancelled.')
  const out = JSON.parse(stdout) as { is_error?: boolean; result?: string }
  if (out.is_error) throw new Error(`Claude Code returned an error: ${out.result ?? 'no detail'}`)
  return (out.result ?? '').trim()
}

async function askWithApi(prompt: string, apiKey: string): Promise<string> {
  const client = new Anthropic({ apiKey })
  const msg = await client.messages.create({
    model: API_MODEL,
    max_tokens: 2048,
    system: ASK_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }]
  })
  return msg.content
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('')
    .trim()
}

/** Mesmo caminho do resumo: assinatura do Claude Code primeiro, chave de API como reserva. */
async function answer(prompt: string, opts: AskOptions): Promise<string> {
  const claude = opts.provider === 'api' ? null : await claudePath()
  const errors: string[] = []
  if (claude) {
    try {
      return await askWithCli(prompt, claude)
    } catch (err) {
      errors.push((err as Error).message)
    }
  } else if (opts.provider === 'claude-cli') {
    errors.push(opts.lang === 'pt' ? 'O Claude Code não foi encontrado neste computador.' : 'Claude Code was not found on this computer.')
  }
  if (opts.provider !== 'claude-cli' && opts.apiKey) return askWithApi(prompt, opts.apiKey)
  if (!opts.apiKey && opts.provider !== 'claude-cli') errors.push(opts.lang === 'pt' ? 'Nenhuma chave de API salva.' : 'No API key saved.')
  throw new Error(errors.join(' '))
}

/** Pergunta em linguagem natural sobre uma nota (`path`) ou sobre todas (`path` nulo). */
export async function askNotes(root: string, question: string, path: string | null, opts: AskOptions): Promise<AskResult> {
  const q = question.trim()
  if (!q) throw new Error(opts.lang === 'pt' ? 'Escreva uma pergunta.' : 'Type a question.')
  const notes = await loadNotes(root, path)
  if (notes.length === 0) throw new Error(opts.lang === 'pt' ? 'Ainda não há notas para consultar.' : 'There are no notes to ask about yet.')
  const { included, omitted, trimmed } = packNotes(notes)
  if (included.length === 0) throw new Error(opts.lang === 'pt' ? 'A nota é grande demais para consultar.' : 'The note is too large to ask about.')
  const text = await answer(buildAskPrompt(q, included), opts)
  return {
    answer: text,
    notes: included.map((n) => n.path),
    sources: citedIds(text, included.length).map((i) => included[i - 1].path),
    omitted,
    trimmed
  }
}
