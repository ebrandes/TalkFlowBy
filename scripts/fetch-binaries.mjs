// Prepara o whisper-cli que vai dentro do instalador.
// Mac: compila o whisper.cpp com Metal (precisa de cmake e Xcode Command Line Tools).
// Windows: baixa o binário oficial x64 (só CPU) e, com o Vulkan SDK instalado (VULKAN_SDK),
// compila também o whisper-cli-gpu.exe, que usa a placa de vídeo. O app tenta o de GPU e volta
// para o de CPU se ele falhar.
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
  // O whisper.cpp do Windows usa o runtime do Visual C++ (MSVCP140, VCRUNTIME140, VCOMP140).
  // Nem todo PC tem o Redistributable instalado; a Microsoft permite levar essas DLLs junto do app.
  const system32 = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32')
  for (const dll of ['msvcp140.dll', 'vcruntime140.dll', 'vcruntime140_1.dll', 'vcomp140.dll']) {
    const src = join(system32, dll)
    if (!existsSync(src)) throw new Error(`${dll} não encontrada em ${system32}; instale o Visual C++ Redistributable para gerar o pacote.`)
    cpSync(src, join(BIN, dll))
  }
  console.log('whisper-cli.exe pronto, com o runtime do Visual C++.')
  winGpu()
}

/** whisper-cli com Vulkan, num .exe só (sem DLLs, para não trocar as do pacote de CPU). */
function winGpu() {
  const target = join(BIN, 'whisper-cli-gpu.exe')
  if (existsSync(target)) return console.log('whisper-cli-gpu.exe já existe.')
  if (!process.env.VULKAN_SDK) return console.log('Sem VULKAN_SDK: o pacote sai só com o Whisper de CPU.')
  if (!existsSync(join(WORK, 'src'))) {
    run('git', ['clone', '--depth', '1', '--branch', VERSION, 'https://github.com/ggml-org/whisper.cpp', join(WORK, 'src')])
  }
  const build = join(WORK, 'build-vulkan')
  run('cmake', ['-S', join(WORK, 'src'), '-B', build, '-DCMAKE_BUILD_TYPE=Release', '-DBUILD_SHARED_LIBS=OFF', '-DGGML_VULKAN=ON', '-DGGML_NATIVE=OFF', '-DWHISPER_BUILD_TESTS=OFF', '-DWHISPER_BUILD_EXAMPLES=ON'])
  run('cmake', ['--build', build, '--config', 'Release', '-j', '--target', 'whisper-cli'])
  const built = [join(build, 'bin', 'Release', 'whisper-cli.exe'), join(build, 'bin', 'whisper-cli.exe')].find((p) => existsSync(p))
  if (!built) throw new Error('A compilação com Vulkan não gerou o whisper-cli.exe.')
  cpSync(built, target)
  console.log('whisper-cli-gpu.exe pronto (Vulkan).')
}

/**
 * Modelos da separação de vozes (sherpa-onnx): pyannote segmentation 3.0 (MIT) e
 * 3D-Speaker CAM++ zh/en (Apache-2.0). Vão junto com o app, para funcionar sem internet.
 */
async function voices() {
  const dir = join(BIN, 'voices')
  const R = 'https://github.com/k2-fsa/sherpa-onnx/releases/download'
  mkdirSync(dir, { recursive: true })
  const embedding = join(dir, 'embedding.onnx')
  if (!existsSync(embedding)) {
    const res = await fetch(`${R}/speaker-recongition-models/3dspeaker_speech_campplus_sv_zh_en_16k-common_advanced.onnx`)
    if (!res.ok) throw new Error(`Modelo de vozes não baixou (${res.status}).`)
    writeFileSync(embedding, Buffer.from(await res.arrayBuffer()))
  }
  const segmentation = join(dir, 'segmentation.onnx')
  if (!existsSync(segmentation)) {
    const res = await fetch(`${R}/speaker-segmentation-models/sherpa-onnx-pyannote-segmentation-3-0.tar.bz2`)
    if (!res.ok) throw new Error(`Modelo de segmentação não baixou (${res.status}).`)
    const tarball = join('.cache', 'segmentation.tar.bz2')
    mkdirSync('.cache', { recursive: true })
    writeFileSync(tarball, Buffer.from(await res.arrayBuffer()))
    run('tar', ['-xjf', tarball, '-C', '.cache'])
    cpSync(join('.cache', 'sherpa-onnx-pyannote-segmentation-3-0', 'model.onnx'), segmentation)
  }
  console.log('Modelos de separação de vozes prontos.')
}

await voices()
if (process.platform === 'darwin') await mac()
else if (process.platform === 'win32') await win()
else console.log('Sistema sem preparo automático; instale o whisper-cli no PATH.')
