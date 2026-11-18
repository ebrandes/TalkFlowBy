import { spawn } from 'node:child_process'
import { rm, writeFile } from 'node:fs/promises'
import type { Flow } from '../../shared/types'

/** Abaixo disso não é fluxo, é só uma lista; não vale desenho. */
export const MIN_STEPS = 3
const PER_ROW = 3
const NODE_W = 240
const NODE_H = 64
const GAP_X = 150
const GAP_Y = 96
const MARGIN = 60
const TOP = 140

export function usableFlow(flow: Flow | null | undefined): flow is Flow {
  return Boolean(flow && flow.passos.length >= MIN_STEPS && flow.ligacoes.length >= 1)
}

interface Placed {
  id: string
  row: number
  col: number
  x: number
  y: number
}

/** Coloca as etapas em "cobrinha": 3 por linha, a linha seguinte volta da direita para a esquerda. */
export function layout(flow: Flow): Placed[] {
  return flow.passos.map((p, i) => {
    const row = Math.floor(i / PER_ROW)
    const pos = i % PER_ROW
    const col = row % 2 === 0 ? pos : PER_ROW - 1 - pos
    return { id: p.id, row, col, x: MARGIN + col * (NODE_W + GAP_X), y: TOP + row * (NODE_H + GAP_Y) }
  })
}

function ports(a: Placed, b: Placed): [string, string] {
  if (a.row === b.row) return a.col < b.col ? ['right', 'left'] : ['left', 'right']
  return a.row < b.row ? ['bottom', 'top'] : ['top', 'bottom']
}

/** Monta o JSON do fireworks-tech-graph (estilo 4, limpo) a partir do fluxo que o Claude devolveu. */
export function fireworksSpec(flow: Flow, subtitle: string, withLabels = true): object {
  const placed = layout(flow)
  const byId = new Map(placed.map((p) => [p.id, p]))
  const rows = Math.max(...placed.map((p) => p.row)) + 1
  const width = MARGIN * 2 + PER_ROW * NODE_W + (PER_ROW - 1) * GAP_X
  const height = TOP + rows * NODE_H + (rows - 1) * GAP_Y + 40
  return {
    schema_version: 1,
    mode: 'workflow',
    style: 4,
    width,
    height,
    title: flow.titulo,
    subtitle,
    nodes: flow.passos.map((p) => {
      const at = byId.get(p.id)!
      return { id: p.id, kind: 'rect', x: at.x, y: at.y, width: NODE_W, height: NODE_H, label: p.rotulo }
    }),
    arrows: flow.ligacoes
      .filter((l) => byId.has(l.de) && byId.has(l.para) && l.de !== l.para)
      .map((l, i) => {
        const [sp, tp] = ports(byId.get(l.de)!, byId.get(l.para)!)
        const label = withLabels && l.rotulo ? { label: l.rotulo } : {}
        return { id: `e${i}`, source: l.de, target: l.para, source_port: sp, target_port: tp, flow: 'control', ...label }
      })
  }
}

const mermaidText = (s: string): string => s.replace(/["\n\r]/g, ' ').replace(/[[\]{}()<>|]/g, ' ').trim()
const mermaidId = (s: string): string => `s_${s.replace(/[^A-Za-z0-9_]/g, '_')}`

/** Mesmo fluxo em Mermaid: texto que o GitHub e o Obsidian desenham sozinhos. */
export function mermaid(flow: Flow): string {
  const lines = ['flowchart TD']
  for (const p of flow.passos) lines.push(`  ${mermaidId(p.id)}["${mermaidText(p.rotulo)}"]`)
  for (const l of flow.ligacoes) {
    const label = l.rotulo ? `|"${mermaidText(l.rotulo)}"|` : ''
    lines.push(`  ${mermaidId(l.de)} -->${label} ${mermaidId(l.para)}`)
  }
  return lines.join('\n')
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true })
    let err = ''
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (err += d))
    child.on('error', reject)
    child.on('close', (code) => {
      // O fireworks responde {"ok": false, ...} quando não consegue montar o desenho.
      if (code === 0 && !/"ok":\s*false/.test(out)) resolve()
      else reject(new Error(err.slice(-300) || out.slice(-300) || `fireworks saiu com ${code}`))
    })
  })
}

/** Desenha o SVG com o fireworks-tech-graph. Devolve false se algo falhar (aí fica o Mermaid). */
export async function renderWithFireworks(python: string, script: string, flow: Flow, subtitle: string, outSvg: string): Promise<boolean> {
  const spec = `${outSvg}.json`
  try {
    // Com os rótulos das setas primeiro; se não couberem, de novo sem eles.
    for (const withLabels of [true, false]) {
      try {
        await writeFile(spec, JSON.stringify(fireworksSpec(flow, subtitle, withLabels)))
        await run(python, [script, 'render', 'workflow', spec, outSvg])
        return true
      } catch {
        /* tenta sem rótulos */
      }
    }
    return false
  } finally {
    await rm(spec, { force: true })
  }
}
