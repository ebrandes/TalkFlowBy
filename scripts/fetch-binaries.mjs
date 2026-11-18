// Prepara o whisper-cli que vai dentro do instalador.
// Mac: compila o whisper.cpp com Metal (precisa de cmake e Xcode Command Line Tools).
// Windows: baixa o binário oficial x64 da página de versões do whisper.cpp.
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const VERSION = 'v1.9.2'
const BIN = join('resources', 'bin')
const WORK = join('.cache', 'whisper.cpp')
mkdirSync(BIN, { recursive: true })

function run(cmd, args, opts = {}) {
  execFileSync(cmd, args, { stdio: 'inherit', ...opts })
}

async function mac() {
  if (existsSync(join(BIN, 'whisper-cli'))) return console.log('whisper-cli já existe.')
  if (!existsSync(WORK)) run('git', ['clone', '--depth', '1', '--branch', VERSION, 'https://github.com/ggml-org/whisper.cpp', WORK])
  const build = join(WORK, 'build')
  run('cmake', ['-S', WORK, '-B', build, '-DCMAKE_BUILD_TYPE=Release', '-DBUILD_SHARED_LIBS=OFF', '-DGGML_METAL=ON', '-DGGML_METAL_EMBED_LIBRARY=ON', '-DWHISPER_BUILD_TESTS=OFF', '-DCMAKE_OSX_ARCHITECTURES=arm64;x86_64'])
  run('cmake', ['--build', build, '--config', 'Release', '-j', '--target', 'whisper-cli'])
  cpSync(join(build, 'bin', 'whisper-cli'), join(BIN, 'whisper-cli'))
  console.log('whisper-cli pronto.')
}

async function win() {
  if (existsSync(join(BIN, 'whisper-cli.exe'))) return console.log('whisper-cli.exe já existe.')
  const url = `https://github.com/ggml-org/whisper.cpp/releases/download/${VERSION}/whisper-bin-x64.zip`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Falha ao baixar ${url}: ${res.status}`)
  mkdirSync(WORK, { recursive: true })
  const zip = join(WORK, 'whisper-bin-x64.zip')
  writeFileSync(zip, Buffer.from(await res.arrayBuffer()))
  const out = join(WORK, 'win')
  rmSync(out, { recursive: true, force: true })
  run('powershell', ['-NoProfile', '-Command', `Expand-Archive -Path '${zip}' -DestinationPath '${out}' -Force`])
  // O zip traz o .exe e as DLLs do ggml; tudo vai junto.
  const release = existsSync(join(out, 'Release')) ? join(out, 'Release') : out
  for (const f of readdirSync(release)) {
    if (/\.(exe|dll)$/i.test(f)) cpSync(join(release, f), join(BIN, f))
  }
  if (!existsSync(join(BIN, 'whisper-cli.exe'))) throw new Error('whisper-cli.exe não veio no pacote.')
  console.log('whisper-cli.exe pronto.')
}

if (process.platform === 'darwin') await mac()
else if (process.platform === 'win32') await win()
else console.log('Sistema sem preparo automático; instale o whisper-cli no PATH.')
