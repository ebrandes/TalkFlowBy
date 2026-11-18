import type { Summary } from '../../shared/types'

export const SUMMARY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['assunto', 'resumo', 'topicos', 'decisoes', 'tarefas'],
  properties: {
    assunto: { type: 'string', description: 'Main subject in at most 8 words, no date, in the meeting language.' },
    resumo: { type: 'string', description: '2 to 4 short sentences: what was discussed and what was decided.' },
    topicos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['titulo', 'pontos'],
        properties: {
          titulo: { type: 'string' },
          pontos: { type: 'array', items: { type: 'string' } }
        }
      }
    },
    decisoes: { type: 'array', items: { type: 'string' } },
    tarefas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['tarefa'],
        properties: {
          tarefa: { type: 'string' },
          responsavel: { type: 'string' }
        }
      }
    }
  }
} as const

export const SYSTEM_PROMPT = [
  'You turn meeting transcripts into short, easy-to-read notes.',
  'The transcript has two voices: the person who recorded it, and the other participants.',
  'Rules:',
  '- Write every field in the same language the meeting was held in.',
  '- assunto (subject): at most 8 words, no date, usable as a file name.',
  '- resumo (summary): 2 to 4 short sentences.',
  '- topicos (topics): 1 to 6 topics, each with a short title and one-line points.',
  '- decisoes (decisions): only what was actually decided; empty list if nothing was.',
  '- tarefas (tasks): agreed actions; set responsavel (owner) only when someone is named in the conversation.',
  '- Never invent names, numbers, dates or decisions that are not in the transcript.',
  '- Ignore transcription noise and repetitions.'
].join('\n')

export function buildUserPrompt(transcript: string): string {
  return `Organize this meeting.\n\n<transcript>\n${transcript}\n</transcript>`
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter(Boolean) : [])

/** Aceita o JSON do modelo e devolve um resumo com todos os campos, mesmo se vier incompleto. */
export function normalizeSummary(raw: unknown): Summary {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const topicos = Array.isArray(obj.topicos) ? obj.topicos : []
  const tarefas = Array.isArray(obj.tarefas) ? obj.tarefas : []
  return {
    assunto: str(obj.assunto),
    resumo: str(obj.resumo),
    topicos: topicos
      .map((t) => {
        const o = (t ?? {}) as Record<string, unknown>
        return { titulo: str(o.titulo), pontos: strList(o.pontos) }
      })
      .filter((t) => t.titulo || t.pontos.length),
    decisoes: strList(obj.decisoes),
    tarefas: tarefas
      .map((t) => {
        const o = (t ?? {}) as Record<string, unknown>
        const responsavel = str(o.responsavel)
        return responsavel ? { tarefa: str(o.tarefa), responsavel } : { tarefa: str(o.tarefa) }
      })
      .filter((t) => t.tarefa)
  }
}

/** Tira o primeiro objeto JSON de um texto (o modelo às vezes cerca com ``` ou frase). */
export function extractJson(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('The model response did not contain JSON.')
  return JSON.parse(text.slice(start, end + 1))
}
