import type { Summary } from '../../shared/types'

export const SUMMARY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['assunto', 'resumo', 'topicos', 'decisoes', 'tarefas'],
  properties: {
    assunto: { type: 'string', description: 'Assunto principal em até 8 palavras, sem data.' },
    resumo: { type: 'string', description: 'De 2 a 4 frases curtas: o que foi tratado e o que ficou decidido.' },
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
  'Você organiza transcrições de reuniões em notas curtas e fáceis de ler.',
  'A transcrição tem duas vozes: "Você" é a pessoa que gravou; "Outros" são os demais participantes.',
  'Regras:',
  '- Escreva no idioma da reunião (normalmente português do Brasil).',
  '- assunto: até 8 palavras, sem data, como título de arquivo.',
  '- resumo: de 2 a 4 frases curtas.',
  '- topicos: de 1 a 6 tópicos, cada um com título curto e pontos de uma linha.',
  '- decisoes: só o que ficou realmente decidido; lista vazia se nada foi decidido.',
  '- tarefas: ações combinadas; coloque o responsável só quando for dito na conversa.',
  '- Não invente nomes, números, prazos ou decisões que não estejam na transcrição.',
  '- Ignore ruídos de transcrição e repetições.'
].join('\n')

export function buildUserPrompt(transcript: string): string {
  return `Organize esta reunião.\n\n<transcricao>\n${transcript}\n</transcricao>`
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
  if (start < 0 || end <= start) throw new Error('A resposta do modelo não trouxe JSON.')
  return JSON.parse(text.slice(start, end + 1))
}
