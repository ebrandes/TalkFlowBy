/** Busca dentro da nota aberta: sem diferenciar maiúsculas nem acentos ("reuniao" acha "Reunião"). */

/** Uma letra sem acento e em minúscula. Pode virar mais de um caractere (raro). */
function foldChar(c: string): string {
  return c.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

/** Texto dobrado e, para cada posição dele, a posição no original. */
function fold(text: string): { folded: string; origin: number[] } {
  let folded = ''
  const origin: number[] = []
  let i = 0
  for (const c of text) {
    const f = foldChar(c)
    for (let k = 0; k < f.length; k++) origin.push(i)
    folded += f
    i += c.length
  }
  origin.push(i)
  return { folded, origin }
}

/** Intervalos [início, fim) de cada ocorrência de `query` em `text`, sem sobreposição. */
export function findMatches(text: string, query: string): Array<[number, number]> {
  const q = fold(query.trim()).folded
  if (!q) return []
  const { folded, origin } = fold(text)
  const out: Array<[number, number]> = []
  let at = folded.indexOf(q)
  while (at >= 0) {
    out.push([origin[at], origin[at + q.length]])
    at = folded.indexOf(q, at + q.length)
  }
  return out
}

/** Próxima posição ao andar `step` (1 ou -1), dando a volta nas pontas. */
export function stepIndex(current: number, total: number, step: number): number {
  if (total === 0) return -1
  return (((current + step) % total) + total) % total
}

const BLOCK = 'P,LI,H1,H2,H3,H4,H5,H6,PRE,BLOCKQUOTE,TD,TH,DIV'

/**
 * Acha `query` no texto visível dentro de `root` e devolve um Range por ocorrência.
 * Junta os pedaços de texto de um mesmo bloco (negrito no meio de uma frase não quebra a busca),
 * mas nunca casa por cima de dois parágrafos.
 */
export function findRanges(root: HTMLElement, query: string): Range[] {
  const nodes: Array<{ node: Text; start: number }> = []
  let text = ''
  let lastBlock: Element | null = null
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const node = n as Text
    if (!node.data) continue
    const block = node.parentElement?.closest(BLOCK) ?? null
    if (block !== lastBlock) {
      text += '\n'
      lastBlock = block
    }
    nodes.push({ node, start: text.length })
    text += node.data
  }

  const locate = (pos: number, end: boolean): { node: Text; offset: number } => {
    // O último pedaço que começa antes de `pos` (ou em `pos`, quando é o início do trecho).
    let lo = 0
    let hi = nodes.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (nodes[mid].start < pos || (!end && nodes[mid].start === pos)) lo = mid
      else hi = mid - 1
    }
    const { node, start } = nodes[lo]
    return { node, offset: Math.min(pos - start, node.data.length) }
  }

  return findMatches(text, query).map(([s, e]) => {
    const a = locate(s, false)
    const b = locate(e, true)
    const range = document.createRange()
    range.setStart(a.node, a.offset)
    range.setEnd(b.node, b.offset)
    return range
  })
}
