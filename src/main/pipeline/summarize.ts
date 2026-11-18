import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import Anthropic from '@anthropic-ai/sdk'
import type { Summary, SummaryProvider } from '../../shared/types'
import { findExecutable } from '../setup/binaries'
import {
  SUMMARY_SCHEMA,
  SYSTEM_PROMPT,
  buildUserPrompt,
  extractJson,
  normalizeSummary
} from './summary-schema'

export const API_MODEL = 'claude-haiku-5-5'
const CLI_TIMEOUT_MS = 4 * 60_000

export interface SummarizeOptions {
  provider: SummaryProvider
  apiKey?: string | null
}

/** Usa a assinatura pelo Claude Code (`claude -p`), com o mínimo de contexto possível. */
export async function summarizeWithCli(transcript: string, claudePath: string): Promise<Summary> {
  const args = [
    '-p', buildUserPrompt('(a transcrição chega pela entrada padrão)'),
    '--model', 'haiku',
    '--output-format', 'json',
    '--tools', '',
    '--system-prompt', SYSTEM_PROMPT,
    '--no-session-persistence',
    '--setting-sources', '',
    '--settings', JSON.stringify({ disableAllHooks: true }),
    '--strict-mcp-config',
    '--disable-slash-commands',
    '--json-schema', JSON.stringify(SUMMARY_SCHEMA)
  ]
  const stdout = await run(claudePath, args, transcript, CLI_TIMEOUT_MS)
  const out = JSON.parse(stdout) as { is_error?: boolean; result?: string; structured_output?: unknown }
  if (out.is_error) throw new Error(`Claude Code devolveu erro: ${out.result ?? 'sem detalhe'}`)
  return normalizeSummary(out.structured_output ?? extractJson(out.result ?? ''))
}

/** Usa a chave de API, forçando a resposta pelo formato do esquema. */
export async function summarizeWithApi(transcript: string, apiKey: string): Promise<Summary> {
  const client = new Anthropic({ apiKey })
  const msg = await client.messages.create({
    model: API_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [{ name: 'registrar_resumo', description: 'Registra o resumo da reunião.', input_schema: SUMMARY_SCHEMA as never }],
    tool_choice: { type: 'tool', name: 'registrar_resumo' },
    messages: [{ role: 'user', content: buildUserPrompt(transcript) }]
  })
  const block = msg.content.find((b) => b.type === 'tool_use')
  if (!block || block.type !== 'tool_use') throw new Error('A API não devolveu o resumo.')
  return normalizeSummary(block.input)
}

/** Escolhe o caminho: assinatura primeiro (se houver Claude Code), chave como reserva. */
export async function summarize(transcript: string, opts: SummarizeOptions): Promise<Summary> {
  const claude = opts.provider === 'api' ? null : await findExecutable('claude')
  const errors: string[] = []
  if (claude) {
    try {
      return await summarizeWithCli(transcript, claude)
    } catch (err) {
      errors.push((err as Error).message)
    }
  } else if (opts.provider === 'claude-cli') {
    errors.push('Claude Code não foi encontrado neste computador.')
  }
  if (opts.provider !== 'claude-cli' && opts.apiKey) return summarizeWithApi(transcript, opts.apiKey)
  if (!opts.apiKey && opts.provider !== 'claude-cli') errors.push('Nenhuma chave de API cadastrada.')
  throw new Error(errors.join(' '))
}

function run(cmd: string, args: string[], input: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: tmpdir(), env: process.env, windowsHide: true })
    let out = ''
    let err = ''
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('O resumo demorou demais e foi cancelado.'))
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
      else reject(new Error(err.trim() || out.trim() || `claude saiu com código ${code}`))
    })
    child.stdin.end(input)
  })
}
