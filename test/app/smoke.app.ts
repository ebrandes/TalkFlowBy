// Abre o TalkFlowBy compilado, com uma pasta de dados vazia, e confere o básico de ponta a ponta.
import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { _electron as electron, type ElectronApplication, type Page } from 'playwright-core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Settings } from '../../src/shared/types'

/** O que a página expõe (`window.talkflow`), do jeito que o teste usa. */
type Bridge = { talkflow: { settings: { get: () => Promise<Settings> } } & Record<string, unknown> }

const require = createRequire(import.meta.url)
const root = resolve(__dirname, '..', '..')
const home = mkdtempSync(join(tmpdir(), 'tfb-app-'))
const notes = join(home, 'notes')

let app: ElectronApplication
let win: Page
const errors: string[] = []

beforeAll(async () => {
  app = await electron.launch({
    executablePath: require('electron') as unknown as string,
    args: [root, `--user-data-dir=${join(home, 'data')}`, ...(process.platform === 'linux' ? ['--no-sandbox'] : [])],
    env: { ...process.env, TALKFLOWBY_ROOT: notes }
  })
  win = await app.firstWindow()
  win.on('pageerror', (e) => errors.push(e.message))
  win.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  await win.waitForSelector('.rail', { timeout: 30_000 })
})

afterAll(async () => {
  await app?.close()
})

describe('app aberto', () => {
  it('carrega a janela com a ponte para o processo principal (sandbox ligado)', async () => {
    const keys = await win.evaluate(() => Object.keys((window as unknown as Bridge).talkflow))
    expect(keys).toEqual(expect.arrayContaining(['library', 'recording', 'settings', 'failed']))
    expect(await win.evaluate(() => (window as unknown as { require?: unknown }).require)).toBeUndefined()
  })

  it('cria uma nota pelo atalho e salva o texto no disco', async () => {
    const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
    await win.keyboard.press(`${mod}+KeyN`)
    await win.waitForSelector('.milkdown .ProseMirror')
    await win.click('.milkdown .ProseMirror')
    await win.keyboard.press(`${mod}+KeyA`)
    await win.keyboard.type('Nota do teste de fumaça')
    await win.waitForTimeout(1500)
    const settings = await win.evaluate(() => (window as unknown as Bridge).talkflow.settings.get())
    const dir = join(settings.rootDir, settings.folders.notes)
    const file = readdirSync(dir).find((f) => f.endsWith('.md'))
    expect(file).toBeDefined()
    expect(readFileSync(join(dir, file!), 'utf8')).toContain('Nota do teste de fumaça')
  })

  it('abre as configurações e a aba de pendências sem erro', async () => {
    await win.click('[role=tab]:nth-child(3)')
    await win.waitForSelector('.list-empty')
    const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
    await win.keyboard.press(`${mod}+Comma`)
    await win.waitForSelector('.settings')
    expect(await win.locator('.kbd').count()).toBeGreaterThanOrEqual(5)
    expect(errors).toEqual([])
  })

  it('usa a pasta de notas pedida no teste', () => {
    expect(existsSync(notes)).toBe(true)
  })
})
