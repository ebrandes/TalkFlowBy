import { spawn, type ChildProcess } from 'node:child_process'
import { createInterface } from 'node:readline'
import type { DetectedMeeting } from '../../shared/types'
import { matchMac } from './apps'

export function meetingsFromReport(line: string): DetectedMeeting[] | null {
  try {
    const report = JSON.parse(line) as { apps?: { bundleId: string }[] }
    const seen = new Map<string, DetectedMeeting>()
    for (const app of report.apps ?? []) {
      const m = matchMac(app.bundleId)
      if (m) seen.set(m.appId, m)
    }
    return [...seen.values()]
  } catch {
    return null
  }
}

/** Mantém o `micwatch` rodando e avisa a cada mudança. Reinicia se ele cair. */
export function watchMac(binary: string, onChange: (apps: DetectedMeeting[]) => void): () => void {
  return watchHelper(binary, meetingsFromReport, onChange)
}

/** Roda um `micwatch` (Mac ou Windows) que imprime uma linha por relatório; reinicia se ele cair. */
export function watchHelper(binary: string, parse: (line: string) => DetectedMeeting[] | null, onChange: (apps: DetectedMeeting[]) => void): () => void {
  let child: ChildProcess | null = null
  let stopped = false
  let restartTimer: NodeJS.Timeout | null = null

  const startChild = (): void => {
    child = spawn(binary, ['2'], { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true })
    const rl = createInterface({ input: child.stdout! })
    rl.on('line', (line) => {
      const apps = parse(line)
      if (apps) onChange(apps)
    })
    // Sem isso, um antivírus bloqueando o helper derrubaria o processo principal.
    child.on('error', () => {})
    child.on('exit', () => {
      if (!stopped) restartTimer = setTimeout(startChild, 5000)
    })
  }

  startChild()
  return () => {
    stopped = true
    if (restartTimer) clearTimeout(restartTimer)
    child?.kill()
  }
}
