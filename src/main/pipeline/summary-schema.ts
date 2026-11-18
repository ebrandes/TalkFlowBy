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
    },
    fluxo: {
      type: ['object', 'null'],
      description: 'Only when the meeting describes a process, workflow, pipeline or decision flow with 3+ steps; otherwise null.',
      additionalProperties: false,
      required: ['titulo', 'passos', 'ligacoes'],
      properties: {
        titulo: { type: 'string' },
        passos: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'rotulo'],
            properties: { id: { type: 'string' }, rotulo: { type: 'string', description: 'At most 3 words and 22 characters.' } }
          }
        },
        ligacoes: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['de', 'para'],
            properties: { de: { type: 'string' }, para: { type: 'string' }, rotulo: { type: 'string', description: 'At most 4 words.' } }
          }
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
  '- Ignore transcription noise and repetitions.',
  '- fluxo (flow): fill it only when the conversation describes a process, workflow, pipeline or decision flow with at',
  '  least 3 steps (for example "first X, then Y, if Z then W"). Steps in order, short labels (max 3 words, 22 characters), ligacoes',
  '  linking step ids, with a short label only when it adds a condition or a date. Otherwise set fluxo to null.'
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
      .filter((t) => t.tarefa),
    fluxo: normalizeFlow(obj.fluxo)
  }
}

function normalizeFlow(raw: unknown): Summary['fluxo'] {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const passos = (Array.isArray(o.passos) ? o.passos : [])
    .map((p) => {
      const x = (p ?? {}) as Record<string, unknown>
      return { id: str(x.id), rotulo: str(x.rotulo) }
    })
    .filter((p) => p.id && p.rotulo)
  const ids = new Set(passos.map((p) => p.id))
  const ligacoes = (Array.isArray(o.ligacoes) ? o.ligacoes : [])
    .map((l) => {
      const x = (l ?? {}) as Record<string, unknown>
      const rotulo = str(x.rotulo)
      return rotulo ? { de: str(x.de), para: str(x.para), rotulo } : { de: str(x.de), para: str(x.para) }
    })
    .filter((l) => ids.has(l.de) && ids.has(l.para) && l.de !== l.para)
  if (passos.length < 3 || ligacoes.length === 0) return null
  return { titulo: str(o.titulo) || 'Fluxo', passos, ligacoes }
}

/** Tira o primeiro objeto JSON de um texto (o modelo às vezes cerca com ``` ou frase). */
export function extractJson(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('The model response did not contain JSON.')
  return JSON.parse(text.slice(start, end + 1))
}
