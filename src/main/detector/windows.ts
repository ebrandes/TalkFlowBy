import { execFile } from 'node:child_process'
import type { DetectedMeeting } from '../../shared/types'
import { matchWindows } from './apps'

const ROOT = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone'

/**
 * Lê a saída de `reg query ... /s` e devolve as chaves que estão usando o microfone agora.
 * O Windows grava `LastUsedTimeStop = 0` enquanto o app está com o microfone aberto.
 */
export function parseConsentStore(output: string): string[] {
  const inUse: string[] = []
  let current: string | null = null
  let start = false
  let stopZero = false
  const flush = (): void => {
    if (current && start && stopZero) inUse.push(current)
  }
  for (const raw of output.split(/\r?\n/)) {
    const line = raw.trim()
    if (/^HKEY_/i.test(line)) {
      flush()
      current = line
      start = false
      stopZero = false
      continue
    }
    const m = line.match(/^(LastUsedTimeStart|LastUsedTimeStop)\s+REG_QWORD\s+(0x[0-9a-f]+)/i)
    if (!m) continue
    const value = BigInt(m[2])
    if (m[1].toLowerCase() === 'lastusedtimestart') start = value > 0n
    else stopZero = value === 0n
  }
  flush()
  return inUse
}

export function meetingsFromKeys(keys: string[]): DetectedMeeting[] {
  const seen = new Map<string, DetectedMeeting>()
  for (const key of keys) {
    const m = matchWindows(key)
    if (m) seen.set(m.appId, m)
  }
  return [...seen.values()]
}

export function pollWindows(): Promise<DetectedMeeting[]> {
  return new Promise((resolve) => {
    execFile('reg', ['query', ROOT, '/s'], { windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
      if (err) return resolve([])
      resolve(meetingsFromKeys(parseConsentStore(stdout)))
    })
  })
}
