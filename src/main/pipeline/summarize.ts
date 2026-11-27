import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import Anthropic from '@anthropic-ai/sdk'
import type { Summary, SummaryProvider } from '../../shared/types'
import { claudePath } from '../setup/binaries'
import {
  SUMMARY_SCHEMA,
  SYSTEM_PROMPT,
  buildUserPrompt,
  extractJson,
  normalizeSummary
} from './summary-schema'

export const API_MODEL = 'claude-haiku-5-5'
/**
 * Quanto esperar o Claude Code: 4 minutos mais 1 por 25 mil caracteres de transcrição e
 * 10 segundos por imagem, até 15. Reuniões longas passavam dos 4 minutos fixos e perdiam o resumo.
 */
export function cliTimeoutMs(transcriptChars: number, images = 0): number {
  return Math.min(15 * 60_000, 4 * 60_000 + Math.ceil(transcriptChars / 25_000) * 60_000 + images * 10_000)
}

export interface SummarizeOptions {
  provider: SummaryProvider
  apiKey?: string | null
}

/** Captura de tela que acompanha a transcrição; o rótulo é o mesmo marcado no texto. */
export interface SummaryImage {
  label: string
  jpeg: Buffer
}

/** Texto do pedido seguido das imagens, cada uma com o rótulo antes. */
function contentBlocks(text: string, images: SummaryImage[]): unknown[] {
  const blocks: unknown[] = [{ type: 'text', text }]
  for (const img of images) {
    blocks.push({ type: 'text', text: `[${img.label}]` })
    blocks.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img.jpeg.toString('base64') } })
  }
  return blocks
}

/** Usa a assinatura pelo Claude Code (`claude -p`), com o mínimo de contexto possível. */
export async function summarizeWithCli(transcript: string, claudePath: string, images: SummaryImage[] = []): Promise<Summary> {
  if (images.length) return summarizeWithCliImages(transcript, claudePath, images)
  const args = [
    '-p', buildUserPrompt('(the transcript arrives on standard input)'),
    '--model', 'haiku',
    '--output-format', 'json',
    ...commonCliArgs()
  ]
  const stdout = await run(claudePath, args, transcript, cliTimeoutMs(transcript.length))
  const out = JSON.parse(stdout) as { is_error?: boolean; result?: string; structured_output?: unknown }
  if (out.is_error) throw new Error(`Claude Code returned an error: ${out.result ?? 'no detail'}`)
  return normalizeSummary(out.structured_output ?? extractJson(out.result ?? ''))
}

/** Sem ferramentas, sem configurações nem histórico do usuário: só o resumo. */
function commonCliArgs(): string[] {
  return [
    '--tools', '',
    '--system-prompt', SYSTEM_PROMPT,
    '--no-session-persistence',
    '--setting-sources', '',
    '--settings', JSON.stringify({ disableAllHooks: true }),
    '--strict-mcp-config',
    '--disable-slash-commands',
    '--json-schema', JSON.stringify(SUMMARY_SCHEMA)
  ]
}

/**
 * Com capturas de tela: a mensagem vai como JSON pela entrada (`--input-format stream-json`),
 * que aceita imagens, e a resposta chega em linhas; a última com `"type":"result"` é o resumo.
 */
async function summarizeWithCliImages(transcript: string, claudePath: string, images: SummaryImage[]): Promise<Summary> {
  const args = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--model', 'haiku', ...commonCliArgs()]
  const message = { type: 'user', message: { role: 'user', content: contentBlocks(buildUserPrompt(transcript, images.length), images) } }
  const stdout = await run(claudePath, args, `${JSON.stringify(message)}\n`, cliTimeoutMs(transcript.length, images.length))
  return parseStreamResult(stdout)
}

/** Acha a linha de resultado na saída em linhas do Claude Code. */
export function parseStreamResult(stdout: string): Summary {
  const lines = stdout.split(/\r?\n/).filter((l) => l.includes('"type":"result"'))
  const last = lines[lines.length - 1]
  if (!last) throw new Error('Claude Code did not return a result.')
  const out = JSON.parse(last) as { is_error?: boolean; result?: string; structured_output?: unknown }
  if (out.is_error) throw new Error(`Claude Code returned an error: ${out.result ?? 'no detail'}`)
  return normalizeSummary(out.structured_output ?? extractJson(out.result ?? ''))
}

/** Usa a chave de API, forçando a resposta pelo formato do esquema. */
export async function summarizeWithApi(transcript: string, apiKey: string, images: SummaryImage[] = []): Promise<Summary> {
  const client = new Anthropic({ apiKey })
  const msg = await client.messages.create({
    model: API_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [{ name: 'registrar_resumo', description: 'Registra o resumo da reunião.', input_schema: SUMMARY_SCHEMA as never }],
    tool_choice: { type: 'tool', name: 'registrar_resumo' },
    messages: [{ role: 'user', content: images.length ? (contentBlocks(buildUserPrompt(transcript, images.length), images) as never) : buildUserPrompt(transcript) }]
  })
  const block = msg.content.find((b) => b.type === 'tool_use')
  if (!block || block.type !== 'tool_use') throw new Error('The API did not return a summary.')
  return normalizeSummary(block.input)
}

/** Escolhe o caminho: assinatura primeiro (se houver Claude Code), chave como reserva. */
export async function summarize(transcript: string, opts: SummarizeOptions, images: SummaryImage[] = []): Promise<Summary> {
  const claude = opts.provider === 'api' ? null : await claudePath()
  const errors: string[] = []
  if (claude) {
    try {
      return await withoutImagesOnFailure(images, (imgs) => summarizeWithCli(transcript, claude, imgs))
    } catch (err) {
      errors.push((err as Error).message)
    }
  } else if (opts.provider === 'claude-cli') {
    errors.push('Claude Code was not found on this computer.')
  }
  if (opts.provider !== 'claude-cli' && opts.apiKey) return withoutImagesOnFailure(images, (imgs) => summarizeWithApi(transcript, opts.apiKey!, imgs))
  if (!opts.apiKey && opts.provider !== 'claude-cli') errors.push('No API key saved.')
  throw new Error(errors.join(' '))
}

/** Imagens ajudam, mas não podem custar o resumo: se der erro com elas, tenta só com o texto. */
async function withoutImagesOnFailure(images: SummaryImage[], call: (imgs: SummaryImage[]) => Promise<Summary>): Promise<Summary> {
  if (images.length === 0) return call([])
  try {
    return await call(images)
  } catch {
    return call([])
  }
}

function run(cmd: string, args: string[], input: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: tmpdir(), env: process.env, windowsHide: true })
    let out = ''
    let err = ''
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('The summary took too long and was cancelled.'))
    }, timeoutMs)
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (err += d))
    child.on('error', (e) => {
      clearTimeout(timer)
      reject(e)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(out)
      else reject(new Error(err.trim() || out.trim() || `claude exited with code ${code}`))
    })
    child.stdin.end(input)
  })
}
