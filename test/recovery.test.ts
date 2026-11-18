import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DONE_FILE, findPending, markProcessing, startFromDirName } from '../src/main/recovery'

const audio = Buffer.alloc(4096, 1)

function session(root: string, name: string, files: Record<string, string | Buffer>): string {
  const dir = join(root, name)
  mkdirSync(dir, { recursive: true })
  for (const [f, content] of Object.entries(files)) writeFileSync(join(dir, f), content)
  return dir
}

describe('recuperação de gravações', () => {
  it('lê o início pelo nome da pasta', () => {
    expect(startFromDirName('2026-11-18T03-43-11-649Z')?.toISOString()).toBe('2026-11-18T03:43:11.649Z')
    expect(startFromDirName('qualquer')).toBeNull()
  })

  it('acha só o que ficou para trás', async () => {
    const root = mkdtempSync(join(tmpdir(), 'tfb-'))
    const meta = JSON.stringify({ startedAt: '2026-11-18T03:00:00.000Z', durationSec: 60 })
    // Fechou gravando: sem meta.json.
    const cut = session(root, '2026-11-18T03-43-11-649Z', { 'mic.webm': audio })
    // Fechou processando: processing.json sem done.json.
    session(root, '2026-11-18T03-50-00-000Z', { 'mic.webm': audio, 'meta.json': meta, 'mic.wav': audio, 'processing.json': '{"attempts":1}' })
    // Já processada (com marcador) e antiga (sem marcadores, com .wav): ficam de fora.
    session(root, '2026-11-18T04-00-00-000Z', { 'mic.webm': audio, 'meta.json': meta, [DONE_FILE]: '{}' })
    session(root, '2026-11-18T04-10-00-000Z', { 'mic.webm': audio, 'meta.json': meta, 'mic.wav': audio })
    // Tentou demais: desiste.
    session(root, '2026-11-18T04-20-00-000Z', { 'mic.webm': audio, 'meta.json': meta, 'processing.json': '{"attempts":3}' })
    // Vazia.
    session(root, '2026-11-18T04-30-00-000Z', { 'mic.webm': Buffer.alloc(10) })

    const found = await findPending(root)
    expect(found.map((p) => p.dir.split('/').pop()).sort()).toEqual(['2026-11-18T03-43-11-649Z', '2026-11-18T03-50-00-000Z'])
    const recovered = JSON.parse(readFileSync(join(cut, 'meta.json'), 'utf8'))
    expect(recovered.startedAt).toBe('2026-11-18T03:43:11.649Z')
  })

  it('conta as tentativas de processamento', async () => {
    const root = mkdtempSync(join(tmpdir(), 'tfb-'))
    const dir = session(root, 'x', {})
    await markProcessing(dir)
    await markProcessing(dir)
    expect(JSON.parse(readFileSync(join(dir, 'processing.json'), 'utf8')).attempts).toBe(2)
  })
})
