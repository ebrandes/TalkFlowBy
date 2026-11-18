import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { claudePath } from '../src/main/setup/binaries'

describe.runIf(process.platform === 'win32')('Claude Code instalado pelo npm (Windows)', () => {
  const oldPath = process.env.PATH
  let root = ''
  afterEach(async () => {
    process.env.PATH = oldPath
    if (root) await rm(root, { recursive: true, force: true })
  })

  it('acha o claude.exe dentro do pacote, pulando uma versão do Node sem ele', async () => {
    root = await mkdtemp(join(tmpdir(), 'tfb-claude-'))
    const broken = join(root, 'v18')
    const good = join(root, 'v22')
    const exeDir = join(good, 'node_modules', '@anthropic-ai', 'claude-code', 'bin')
    await mkdir(broken, { recursive: true })
    await mkdir(exeDir, { recursive: true })
    await writeFile(join(broken, 'claude.cmd'), '')
    await writeFile(join(good, 'claude.cmd'), '')
    await writeFile(join(exeDir, 'claude.exe'), '')
    process.env.PATH = [broken, good].join(delimiter)
    expect(await claudePath()).toBe(join(exeDir, 'claude.exe'))
  })
})
