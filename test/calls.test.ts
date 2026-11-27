import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { callsInWindows, meetTitle, teamsTitle, type WindowInfo } from '../src/main/detector/calls'
import { END_AFTER_MS, HOLD_BROWSER_MS, MeetingDetector, START_AFTER_MS, type CallInfo } from '../src/main/detector/index'
import { parseWinReport } from '../src/main/detector/windows'
import { SummaryRetry } from '../src/main/summary-retry'

const teams = { appId: 'teams', appName: 'Microsoft Teams' }
const chrome = { appId: 'chrome', appName: 'Google Meet (Chrome)' }
const main: WindowInfo = { exe: 'ms-teams.exe', title: 'Chat | Fulano | Microsoft Teams' }
const win = (title: string, exe = 'ms-teams.exe'): WindowInfo => ({ exe, title })

describe('títulos das janelas', () => {
  it('reconhece a janela da reunião do Teams e ignora a janela principal', () => {
    expect(teamsTitle('Daily do time | Microsoft Teams')).toBe('Daily do time')
    expect(teamsTitle('Reunião em "Geral" | Microsoft Teams')).toBe('Reunião em "Geral"')
    expect(teamsTitle('Chat | Fulano | Microsoft Teams')).toBeNull()
    expect(teamsTitle('Calendário | Microsoft Teams')).toBeNull()
    expect(teamsTitle('Atividade | Microsoft Teams')).toBeNull()
    expect(teamsTitle('Microsoft Teams')).toBeNull()
    expect(teamsTitle('Microsoft Teams Notification')).toBeNull()
    expect(teamsTitle('Notificação do Microsoft Teams')).toBeNull()
    expect(teamsTitle('Sharing control bar | Microsoft Teams')).toBeNull()
  })

  it('reconhece a aba do Google Meet', () => {
    expect(meetTitle('Meet - abc-defg-hij - Google Chrome')).toEqual({ key: 'meet:abc-defg-hij', title: undefined, strong: true })
    expect(meetTitle('Meet: Planejamento Q1 - Google Chrome')?.title).toBe('Planejamento Q1')
    expect(meetTitle('Meet – abc-defg-hij — Mozilla Firefox')?.key).toBe('meet:abc-defg-hij')
    expect(meetTitle('Meet - abc-defg-hij - Pessoal - Microsoft​ Edge')?.key).toBe('meet:abc-defg-hij')
    expect(meetTitle('Meet - Google Chrome')).toBeNull()
    expect(meetTitle('Google Meet - Google Chrome')).toBeNull()
    expect(meetTitle('WhatsApp - Google Chrome')).toBeNull()
  })

  it('separa as janelas por app', () => {
    const windows = [win('Daily | Microsoft Teams'), win('Meet - abc-defg-hij - Google Chrome', 'chrome.exe'), win('Sync | Microsoft Teams - Google Chrome', 'chrome.exe')]
    expect(callsInWindows('teams', windows).map((c) => c.key)).toEqual(['teams:daily'])
    expect(callsInWindows('chrome', windows).map((c) => c.key)).toEqual(['meet:abc-defg-hij', 'teams:sync'])
    expect(callsInWindows('edge', windows)).toEqual([])
  })

  it('lê as janelas do relatório do helper', () => {
    const r = parseWinReport('{"apps":[{"pid":1,"chain":["ms-teams.exe"]}],"windows":[{"exe":"ms-teams.exe","title":"Daily \\"1\\" | Microsoft Teams"}]}')
    expect(r?.apps).toEqual([teams])
    expect(r?.windows).toEqual([win('Daily "1" | Microsoft Teams')])
    expect(parseWinReport('{"apps":[]}')?.windows).toBeUndefined()
  })
})

function record(d: MeetingDetector): string[] {
  const events: string[] = []
  const name = (c: CallInfo): string => `${c.appId}${c.title ? `(${c.title})` : ''}`
  d.on('start', (c) => events.push(`start:${name(c)}`))
  d.on('end', (c) => events.push(`end:${name(c)}`))
  d.on('switch', (a, b) => events.push(`switch:${name(a)}>${name(b)}`))
  return events
}

/** Simula o helper a cada segundo, de `from` até `to`. */
function run(d: MeetingDetector, from: number, to: number, apps: typeof teams[], windows: WindowInfo[]): number {
  for (let t = from; t <= to; t += 1000) d.update(apps, t, windows)
  return to
}

describe('MeetingDetector com janelas', () => {
  it('saiu de uma reunião do Teams e entrou em outra: duas chamadas', () => {
    const d = new MeetingDetector()
    const ev = record(d)
    run(d, 0, 0, [], [main])
    // A janela principal está aberta há horas; a da reunião abre ao entrar.
    let t = run(d, 60 * 60_000, 60 * 60_000 + START_AFTER_MS + 60_000, [teams], [main, win('Daily | Microsoft Teams')])
    expect(ev).toEqual(['start:teams(Daily)'])
    // Saiu: a janela fecha e o microfone solta por alguns segundos; entra na próxima.
    t = run(d, t + 1000, t + 6000, [], [main])
    t = run(d, t + 1000, t + 30_000, [teams], [main, win('1:1 com Ana | Microsoft Teams')])
    expect(ev).toEqual(['start:teams(Daily)', 'switch:teams(Daily)>teams(1:1 com Ana)'])
    // Saiu de vez.
    run(d, t + 1000, t + END_AFTER_MS + 2000, [], [main])
    expect(ev.at(-1)).toBe('end:teams(1:1 com Ana)')
  })

  it('a janela da reunião aberta segura a chamada durante a queda de internet', () => {
    const d = new MeetingDetector()
    const ev = record(d)
    const call = [main, win('Daily | Microsoft Teams')]
    let t = run(d, 0, START_AFTER_MS + 10_000, [teams], call)
    // O Teams soltou o microfone reconectando, por 3 minutos, mas a janela continua lá.
    t = run(d, t + 1000, t + 3 * 60_000, [], call)
    expect(ev).toEqual(['start:teams(Daily)'])
    // Voltou: mesma reunião, nada de nova chamada.
    t = run(d, t + 1000, t + 20_000, [teams], call)
    expect(ev).toEqual(['start:teams(Daily)'])
    // Fechou a janela: termina depois do tempo normal.
    run(d, t + 1000, t + END_AFTER_MS + 2000, [], [main])
    expect(ev).toEqual(['start:teams(Daily)', 'end:teams(Daily)'])
  })

  it('a mesma reunião depois de uma queda curta continua sendo uma só', () => {
    const d = new MeetingDetector()
    const ev = record(d)
    const call = [win('Daily | Microsoft Teams')]
    let t = run(d, 0, START_AFTER_MS + 10_000, [teams], call)
    t = run(d, t + 1000, t + 10_000, [], [])
    run(d, t + 1000, t + 10_000, [teams], call)
    expect(ev).toEqual(['start:teams(Daily)'])
  })

  it('sem janelas (Mac), calls separadas pelo tempo sem microfone', () => {
    const d = new MeetingDetector()
    const ev = record(d)
    let t = run(d, 0, START_AFTER_MS + 1000, [teams], undefined as unknown as WindowInfo[])
    t = run(d, t + 1000, t + END_AFTER_MS + 1000, [], undefined as unknown as WindowInfo[])
    run(d, t + 1000, t + START_AFTER_MS + 2000, [teams], undefined as unknown as WindowInfo[])
    expect(ev).toEqual(['start:teams', 'end:teams', 'start:teams'])
  })

  it('no navegador, só tem certeza com a aba da reunião', () => {
    const d = new MeetingDetector()
    const starts: CallInfo[] = []
    d.on('start', (c) => starts.push(c))
    run(d, 0, START_AFTER_MS, [chrome], [win('WhatsApp - Google Chrome', 'chrome.exe')])
    expect(starts[0].confident).toBe(false)

    const d2 = new MeetingDetector()
    const s2: CallInfo[] = []
    d2.on('start', (c) => s2.push(c))
    run(d2, 0, START_AFTER_MS, [chrome], [win('Meet - abc-defg-hij - Google Chrome', 'chrome.exe')])
    expect(s2[0]).toMatchObject({ confident: true, appId: 'chrome' })
  })

  it('aba do Meet aberta depois de sair: segura só por pouco tempo', () => {
    const d = new MeetingDetector()
    const ev = record(d)
    const tab = [win('Meet - abc-defg-hij - Google Chrome', 'chrome.exe')]
    let t = run(d, 0, START_AFTER_MS + 5000, [chrome], tab)
    t = run(d, t + 1000, t + END_AFTER_MS + 5000, [], tab)
    expect(ev).toEqual(['start:chrome'])
    run(d, t + 1000, t + HOLD_BROWSER_MS, [], tab)
    expect(ev).toEqual(['start:chrome', 'end:chrome'])
  })

  it('trocar de reunião no Meet vira outra chamada', () => {
    const d = new MeetingDetector()
    const ev = record(d)
    let t = run(d, 0, START_AFTER_MS + 5000, [chrome], [win('Meet - abc-defg-hij - Google Chrome', 'chrome.exe')])
    t = run(d, t + 1000, t + 5000, [], [win('Meet - abc-defg-hij - Google Chrome', 'chrome.exe')])
    run(d, t + 1000, t + 5000, [chrome], [win('Meet - xyz-abcd-efg - Google Chrome', 'chrome.exe')])
    expect(ev).toEqual(['start:chrome', 'switch:chrome>chrome'])
  })

  it('janela nova sem o microfone fechar não troca de chamada (compartilhar tela, chat solto)', () => {
    const d = new MeetingDetector()
    const ev = record(d)
    let t = run(d, 0, START_AFTER_MS + 5000, [teams], [win('Daily | Microsoft Teams')])
    t = run(d, t + 1000, t + 30_000, [teams], [win('Daily (modo compacto) | Microsoft Teams')])
    run(d, t + 1000, t + 10_000, [teams], [win('Ana | Microsoft Teams')])
    expect(ev).toEqual(['start:teams(Daily)'])
  })

  it('rearm: a gravação parou por silêncio mas a reunião segue, vira um novo start', () => {
    const d = new MeetingDetector()
    const ev = record(d)
    const t = run(d, 0, START_AFTER_MS + 1000, [teams], [])
    d.rearm('teams')
    run(d, t + 1000, t + START_AFTER_MS + 1000, [teams], [])
    expect(ev).toEqual(['start:teams', 'start:teams'])
  })
})

describe('SummaryRetry', () => {
  let dir = ''
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  it('gera o resumo quando a internet volta e esquece notas apagadas', async () => {
    dir = await mkdtemp(join(tmpdir(), 'tfb-retry-'))
    await mkdir(join(dir, 'notes'))
    await writeFile(join(dir, 'notes', 'a.md'), 'x')
    let online = false
    const tried: string[] = []
    const done: string[][] = []
    const r = new SummaryRetry(join(dir, 'retry.json'), () => join(dir, 'notes'), async (rel) => (tried.push(rel), { ok: true }), () => online, (p) => done.push(p))
    await r.add('a.md')
    await r.add('sumiu.md')
    await r.add('a.md')
    expect(await r.run()).toEqual([])
    expect(tried).toEqual([])
    online = true
    expect(await r.run()).toEqual(['a.md'])
    expect(done).toEqual([['a.md']])
    expect(JSON.parse(await readFile(join(dir, 'retry.json'), 'utf8'))).toEqual([])
  })

  it('continua na lista quando falha, e vale depois de reiniciar', async () => {
    dir = await mkdtemp(join(tmpdir(), 'tfb-retry-'))
    await writeFile(join(dir, 'a.md'), 'x')
    const r = new SummaryRetry(join(dir, 'retry.json'), () => dir, async () => ({ ok: false }))
    await r.add('a.md')
    await r.run()
    const again = new SummaryRetry(join(dir, 'retry.json'), () => dir, async () => ({ ok: true }))
    expect((await again.pending())[0]).toMatchObject({ path: 'a.md', attempts: 1 })
    expect(await again.run()).toEqual(['a.md'])
  })
})
