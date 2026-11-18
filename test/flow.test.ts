import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { lint } from 'markdownlint/sync'
import { describe, expect, it } from 'vitest'
import type { Flow } from '../src/shared/types'
import { fireworksSpec, layout, mermaid, renderWithFireworks, usableFlow } from '../src/main/pipeline/flow'
import { buildMeetingMarkdown } from '../src/main/pipeline/markdown'
import { normalizeSummary } from '../src/main/pipeline/summary-schema'
import { summarize } from '../src/main/pipeline/summarize'
import { fireworksPaths } from '../src/main/setup/binaries'
import { pt } from '../src/shared/i18n/pt'

const flow: Flow = {
  titulo: 'Aprovação de feature',
  passos: [
    { id: 'a', rotulo: 'Ideia no backlog' },
    { id: 'b', rotulo: 'Refinamento técnico' },
    { id: 'c', rotulo: 'Aprovação do PO' },
    { id: 'd', rotulo: 'Desenvolvimento' },
    { id: 'e', rotulo: 'Homologação' }
  ],
  ligacoes: [
    { de: 'a', para: 'b' },
    { de: 'b', para: 'c', rotulo: 'com estimativa' },
    { de: 'c', para: 'd' },
    { de: 'd', para: 'e' },
    { de: 'e', para: 'b', rotulo: 'se reprovar' }
  ]
}

describe('fluxo', () => {
  it('só desenha com 3 etapas ou mais', () => {
    expect(usableFlow(flow)).toBe(true)
    expect(usableFlow({ ...flow, passos: flow.passos.slice(0, 2) })).toBe(false)
    expect(usableFlow(null)).toBe(false)
  })

  it('cobrinha de 3 por linha e portas certas', () => {
    const placed = layout(flow)
    expect(placed.map((p) => [p.row, p.col])).toEqual([[0, 0], [0, 1], [0, 2], [1, 2], [1, 1]])
    const spec = fireworksSpec(flow, 'x') as { arrows: { source_port: string; target_port: string }[] }
    expect(spec.arrows[0]).toMatchObject({ source_port: 'right', target_port: 'left' })
    expect(spec.arrows[2]).toMatchObject({ source_port: 'bottom', target_port: 'top' })
    expect(spec.arrows[3]).toMatchObject({ source_port: 'left', target_port: 'right' })
  })

  it('Mermaid sem caracteres que quebram', () => {
    const m = mermaid({ ...flow, passos: [{ id: 'a-1', rotulo: 'Pedir "ok" [rápido]' }, ...flow.passos.slice(1)] })
    expect(m).toContain('s_a_1["Pedir  ok   rápido"]')
    expect(m).toContain('-->|"se reprovar"|')
  })

  it('normaliza e descarta fluxo fraco', () => {
    expect(normalizeSummary({ fluxo: { titulo: 'x', passos: [{ id: 'a', rotulo: 'A' }], ligacoes: [] } }).fluxo).toBeNull()
    expect(normalizeSummary({ fluxo: flow }).fluxo?.passos).toHaveLength(5)
  })

  it('seção no fim da nota, com imagem ou Mermaid', () => {
    const meta = { startedAt: new Date(2026, 10, 17, 14, 30), durationSec: 600 }
    const summary = normalizeSummary({ assunto: 'Aprovação de features', resumo: 'R.', fluxo: flow })
    const withImage = buildMeetingMarkdown(meta, summary, [], pt.doc, { image: '2026-11-17 14h30 - Fluxo - fluxo.svg' })
    expect(withImage.trimEnd().endsWith('![Diagrama do fluxo](2026-11-17%2014h30%20-%20Fluxo%20-%20fluxo.svg)')).toBe(true)
    const withMermaid = buildMeetingMarkdown(meta, summary, [], pt.doc, { mermaid: mermaid(flow) })
    expect(withMermaid).toContain('## Fluxo\n\n```mermaid\nflowchart TD')
    for (const md of [withImage, withMermaid]) expect(lint({ strings: { n: md }, config: { default: true, MD013: false } }).n).toEqual([])
  })
})

describe.skipIf(!process.env.E2E_FLOW)('fluxo de verdade (Claude + fireworks)', () => {
  it('reconhece um processo e desenha o SVG', async () => {
    const transcript = [
      '[00:00] Você: Vamos combinar como uma feature nova anda daqui pra frente.',
      '[00:10] Outros: Primeiro a ideia entra no backlog. Depois a gente faz o refinamento técnico com estimativa.',
      '[00:25] Você: Com a estimativa, o PO aprova. Aprovado, vai para desenvolvimento.',
      '[00:40] Outros: Depois do desenvolvimento vai para homologação. Se reprovar na homologação, volta para o refinamento.',
      '[00:55] Você: Fechado, e se passar na homologação, publica na sexta.'
    ].join('\n')
    const summary = await summarize(transcript, { provider: 'claude-cli' })
    console.log(JSON.stringify(summary.fluxo, null, 1))
    expect(usableFlow(summary.fluxo)).toBe(true)
    const fw = await fireworksPaths()
    expect(fw).not.toBeNull()
    const out = join(mkdtempSync(join(tmpdir(), 'tfb-flow-')), 'fluxo.svg')
    expect(await renderWithFireworks(fw!.python, fw!.script, summary.fluxo!, summary.assunto, out)).toBe(true)
    expect(existsSync(out) && readFileSync(out, 'utf8').includes('<svg')).toBe(true)
    console.log(out)
  }, 180_000)
})
