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
  const names = isWin ? [`${name}.exe`, name] : [name]
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
