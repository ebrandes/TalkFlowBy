import { describe, expect, it } from 'vitest'
import { matchMac, matchWindowsChain } from '../src/main/detector/apps'
import { END_AFTER_MS, MeetingDetector, START_AFTER_MS } from '../src/main/detector/index'
import { meetingsFromReport } from '../src/main/detector/mac'
import { meetingsFromKeys, meetingsFromWinReport, parseConsentStore } from '../src/main/detector/windows'

const REG = String.raw`
HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\microphone
    Value    REG_SZ    Allow

HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\microphone\MSTeams_8wekyb3d8bbwe
    Value    REG_SZ    Allow
    LastUsedTimeStart    REG_QWORD    0x1dc5a1b2c3d4e5f
    LastUsedTimeStop    REG_QWORD    0x0

HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\microphone\NonPackaged\C:#Program Files#Google#Chrome#Application#chrome.exe
    LastUsedTimeStart    REG_QWORD    0x1dc5a1b2c3d4e5f
    LastUsedTimeStop    REG_QWORD    0x1dc5a1b2c3d9999

HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\microphone\NonPackaged\C:#Users#eu#AppData#Local#Programs#TalkFlowBy#TalkFlowBy.exe
    LastUsedTimeStart    REG_QWORD    0x1dc5a1b2c3d4e5f
    LastUsedTimeStop    REG_QWORD    0x0
`

describe('Windows', () => {
  it('acha quem está com o microfone aberto e ignora o próprio app', () => {
    const keys = parseConsentStore(REG)
    expect(keys).toHaveLength(2)
    expect(meetingsFromKeys(keys)).toEqual([{ appId: 'teams', appName: 'Microsoft Teams' }])
  })
})

describe('Windows (micwatch.exe)', () => {
  it('acha o app pela cadeia de processos, passando pelo WebView2', () => {
    expect(matchWindowsChain(['ms-teams.exe', 'ms-teams.exe', 'explorer.exe'])?.appId).toBe('teams')
    expect(matchWindowsChain(['msedgewebview2.exe', 'msedgewebview2.exe', 'ms-teams.exe', 'explorer.exe'])?.appId).toBe('teams')
    expect(matchWindowsChain(['chrome.exe', 'chrome.exe', 'explorer.exe'])?.appId).toBe('chrome')
    expect(matchWindowsChain(['msedge.exe', 'explorer.exe'])?.appId).toBe('edge')
    expect(matchWindowsChain(['Zoom.exe', 'explorer.exe'])?.appId).toBe('zoom')
  })

  it('ignora o próprio app, WebView2 de outros apps e programas abertos pelo navegador', () => {
    expect(matchWindowsChain(['TalkFlowBy.exe', 'TalkFlowBy.exe', 'explorer.exe'])).toBeNull()
    expect(matchWindowsChain(['msedgewebview2.exe', 'olk.exe', 'explorer.exe'])).toBeNull()
    expect(matchWindowsChain(['Discord.exe', 'chrome.exe', 'explorer.exe'])).toBeNull()
    expect(matchWindowsChain(['ffmpeg.exe', 'TalkFlowBy.exe'])).toBeNull()
    expect(matchWindowsChain(['xarc.exe'])).toBeNull()
    expect(matchWindowsChain([])).toBeNull()
  })

  it('lê o relatório do helper', () => {
    const line = '{"apps":[{"pid":1,"chain":["ms-teams.exe","explorer.exe"]},{"pid":2,"chain":["ms-teams.exe","explorer.exe"]},{"pid":3,"chain":["Spotify.exe"]}]}'
    expect(meetingsFromWinReport(line)).toEqual([{ appId: 'teams', appName: 'Microsoft Teams' }])
    expect(meetingsFromWinReport('{"apps":[]}')).toEqual([])
    expect(meetingsFromWinReport('lixo')).toBeNull()
  })
})

describe('Mac', () => {
  it('reconhece navegadores pelo processo helper', () => {
    expect(matchMac('com.google.Chrome.helper')?.appId).toBe('chrome')
    expect(matchMac('com.github.Electron')).toBeNull()
    const apps = meetingsFromReport('{"apps":[{"bundleId":"com.microsoft.teams2","pid":1},{"bundleId":"com.apple.Music","pid":2}]}')
    expect(apps).toEqual([{ appId: 'teams', appName: 'Microsoft Teams' }])
    expect(meetingsFromReport('lixo')).toBeNull()
  })
})

describe('MeetingDetector', () => {
  const teams = { appId: 'teams', appName: 'Microsoft Teams' }

  it('pergunta só depois de alguns segundos e encerra após o silêncio', () => {
    const d = new MeetingDetector()
    const events: string[] = []
    d.on('start', (a) => events.push(`start:${a.appId}`))
    d.on('end', (a) => events.push(`end:${a.appId}`))
    d.update([teams], 0)
    d.update([teams], START_AFTER_MS - 1)
    expect(events).toEqual([])
    d.update([teams], START_AFTER_MS)
    d.update([teams], START_AFTER_MS + 1000)
    expect(events).toEqual(['start:teams'])
    d.update([], START_AFTER_MS + 2000)
    d.update([], START_AFTER_MS + 1000 + END_AFTER_MS)
    expect(events).toEqual(['start:teams', 'end:teams'])
  })

  it('avisa o fim da reunião mesmo de app silenciado', () => {
    const d = new MeetingDetector((id) => id === 'teams')
    const events: string[] = []
    d.on('start', () => events.push('start'))
    d.on('end', () => events.push('end'))
    d.update([teams], 0)
    d.update([teams], START_AFTER_MS)
    expect(d.anyInCall()).toBe(true)
    d.update([], START_AFTER_MS + 1)
    d.update([], START_AFTER_MS + END_AFTER_MS + 1)
    expect(events).toEqual(['end'])
    expect(d.anyInCall()).toBe(false)
  })

  it('não pergunta para app silenciado', () => {
    const d = new MeetingDetector((id) => id === 'teams')
    let started = false
    d.on('start', () => (started = true))
    d.update([teams], 0)
    d.update([teams], START_AFTER_MS * 2)
    expect(started).toBe(false)
  })
})
