import { describe, expect, it } from 'vitest'
import { findMatches, stepIndex } from '../src/renderer/src/lib/find'

describe('buscar na nota', () => {
  it('ignora maiúsculas e acentos', () => {
    const text = 'Reunião de hoje. A reuniao seguinte e a REUNIÃO final.'
    const hits = findMatches(text, 'reunião')
    expect(hits.map(([s, e]) => text.slice(s, e))).toEqual(['Reunião', 'reuniao', 'REUNIÃO'])
    expect(findMatches(text, 'reuniao')).toEqual(hits)
  })

  it('devolve posições no texto original, mesmo com acento decomposto', () => {
    const text = 'café e café'
    expect(findMatches(text, 'cafe').map(([s, e]) => text.slice(s, e))).toEqual(['café', 'café'])
  })

  it('não acha nada com busca vazia e não sobrepõe ocorrências', () => {
    expect(findMatches('abc', '   ')).toEqual([])
    expect(findMatches('aaaa', 'aa')).toEqual([
      [0, 2],
      [2, 4]
    ])
  })

  it('dá a volta nas pontas ao andar entre ocorrências', () => {
    expect(stepIndex(2, 3, 1)).toBe(0)
    expect(stepIndex(0, 3, -1)).toBe(2)
    expect(stepIndex(-1, 3, 1)).toBe(0)
    expect(stepIndex(0, 0, 1)).toBe(-1)
  })
})
