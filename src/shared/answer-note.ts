// Monta a nota salva a partir de uma resposta da pesquisa inteligente, com links para as notas citadas.

export interface AnswerNoteInput {
  question: string
  answer: string
  /** Notas enviadas ao modelo; o número citado [n] é a posição aqui (1 = a primeira). */
  notes: string[]
  sources: string[]
}

export interface AnswerNoteLabels {
  /** Linha de contexto, por exemplo "Pergunta feita em 27/11/2026 14:15 às notas." */
  asked: string
  sources: string
}

/** Caminho de `to` visto da pasta da nota `from` (os dois relativos à raiz, com "/"). */
export function relativeLink(from: string, to: string): string {
  const fromDir = from.split('/').slice(0, -1)
  const target = to.split('/')
  let i = 0
  while (i < fromDir.length && i < target.length - 1 && fromDir[i] === target[i]) i++
  return [...fromDir.slice(i).map(() => '..'), ...target.slice(i)].join('/')
}

/** Link Markdown que o TalkFlowBy, o Obsidian e o GitHub abrem: caminho relativo com espaços codificados. */
export function noteLink(from: string, to: string, text: string): string {
  const href = relativeLink(from, to).split('/').map(encodeURIComponent).join('/')
  return `[${text.replace(/[[\]]/g, '')}](${href})`
}

/** Nome legível: "2026-11-27 09h12 - Assunto" vira "Assunto (27/11/2026 09:12)". */
export function linkTitle(path: string): string {
  const name = path.split('/').pop()!.replace(/\.md$/i, '')
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2})[h.](\d{2}) - (.+)$/.exec(name)
  return m ? `${m[6]} (${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]})` : name
}

/** Título curto para o arquivo, tirado da pergunta. */
export function answerTitle(question: string): string {
  const q = question.trim().replace(/\s+/g, ' ').replace(/[?!.:;]+$/, '')
  const short = q.length > 70 ? `${q.slice(0, 70).replace(/\s+\S*$/, '')}…` : q
  return short.charAt(0).toUpperCase() + short.slice(1)
}

/** Corpo da nota: pergunta, resposta com as citações virando links e a lista de fontes. */
export function answerNoteBody(notePath: string, title: string, input: AnswerNoteInput, labels: AnswerNoteLabels): string {
  const cite = (n: number): string | null => {
    const target = input.notes[n - 1]
    return target ? noteLink(notePath, target, `${n}`) : null
  }
  const answer = input.answer.replace(/\[(\d{1,3})\]/g, (all, n: string) => {
    const link = cite(Number(n))
    return link ? `[${link}]` : all
  })
  const out = [`# ${title}`, '', `> ${input.question.trim().replace(/\n+/g, ' ')}`, '', `*${labels.asked}*`, '', answer.trim(), '']
  if (input.sources.length) {
    out.push(`## ${labels.sources}`, '')
    for (const s of input.sources) out.push(`- (${input.notes.indexOf(s) + 1}) ${noteLink(notePath, s, linkTitle(s))}`)
    out.push('')
  }
  return out.join('\n')
}
