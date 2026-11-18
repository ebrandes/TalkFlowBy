import { access, constants } from 'node:fs/promises'
import { homedir } from 'node:os'
import { delimiter, join } from 'node:path'
import ffmpegStatic from 'ffmpeg-static'

const isWin = process.platform === 'win32'

/** Apps abertos pelo Finder ou pelo menu Iniciar não herdam o PATH do terminal. */
function extraDirs(): string[] {
  const home = homedir()
  if (isWin) {
    const appData = process.env.APPDATA ?? join(home, 'AppData', 'Roaming')
    const local = process.env.LOCALAPPDATA ?? join(home, 'AppData', 'Local')
    return [join(home, '.local', 'bin'), join(appData, 'npm'), join(local, 'Programs', 'claude')]
  }
  return ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', join(home, '.local', 'bin'), join(home, '.claude', 'local'), join(home, '.npm-global', 'bin')]
}

async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path, isWin ? constants.F_OK : constants.X_OK)
    return true
  } catch {
    return false
  }
}

/** Procura um programa no PATH e nas pastas comuns de instalação. */
export async function findExecutable(name: string): Promise<string | null> {
  const dirs = [...(process.env.PATH ?? '').split(delimiter).filter(Boolean), ...extraDirs()]
  // No Windows só um .exe roda direto; o atalho do npm (sem extensão ou .cmd) não.
  const names = isWin ? [`${name}.exe`] : [name]
  for (const dir of dirs) {
    for (const n of names) {
      const full = join(dir, n)
      if (await isExecutable(full)) return full
    }
  }
  return null
}

/** Pasta dos binários que vão junto com o app (whisper-cli, micwatch). */
export function bundledBinDir(): string {
  const res = process.resourcesPath ?? ''
  const isDev = !res || res.includes('node_modules')
  return isDev ? join(process.cwd(), 'resources', 'bin') : join(res, 'bin')
}

export async function whisperPath(): Promise<string | null> {
  const bundled = join(bundledBinDir(), isWin ? 'whisper-cli.exe' : 'whisper-cli')
  if (await isExecutable(bundled)) return bundled
  return findExecutable('whisper-cli')
}

/**
 * A skill fireworks-tech-graph, se estiver instalada (Claude Code ou Codex), mais o Python para rodá-la.
 * Sem ela o fluxo vai em Mermaid, que o GitHub e o Obsidian desenham sozinhos.
 */
export async function fireworksPaths(): Promise<{ python: string; script: string } | null> {
  const home = homedir()
  const roots = [join(home, '.claude', 'skills', 'fireworks-tech-graph'), join(home, '.codex', 'skills', 'fireworks-tech-graph'), join(home, '.agents', 'skills', 'fireworks-tech-graph')]
  let script: string | null = null
  for (const r of roots) {
    const s = join(r, 'scripts', 'fireworks.py')
    try {
      await access(s, constants.F_OK)
      script = s
      break
    } catch {
      /* tenta a próxima */
    }
  }
  if (!script) return null
  const python = (await findExecutable('python3')) ?? (await findExecutable('python'))
  return python ? { python, script } : null
}

export async function micwatchPath(): Promise<string | null> {
  const bundled = join(bundledBinDir(), 'micwatch')
  return (await isExecutable(bundled)) ? bundled : null
}

/** ffmpeg do pacote ffmpeg-static; dentro do .asar o arquivo fica na pasta "unpacked". */
export function ffmpegPath(): string {
  const p = ffmpegStatic as unknown as string
  if (!p) throw new Error('ffmpeg não está disponível para este sistema.')
  return p.replace('app.asar', 'app.asar.unpacked')
}
