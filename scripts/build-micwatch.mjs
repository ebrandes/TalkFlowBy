// Compila o helper que diz quais apps estão usando o microfone.
// Mac: Swift (CoreAudio). Windows: C# (WASAPI) com o csc.exe do .NET Framework que já vem no sistema.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

mkdirSync('resources/bin', { recursive: true })

function mac() {
  const out = 'resources/bin/micwatch'
  const archs = ['arm64', 'x86_64']
  const parts = archs.map((a) => {
    const p = `${out}-${a}`
    execFileSync('swiftc', ['-O', '-target', `${a}-apple-macos14.2`, 'native/mac/micwatch.swift', '-o', p], { stdio: 'inherit' })
    return p
  })
  execFileSync('lipo', ['-create', ...parts, '-output', out], { stdio: 'inherit' })
  for (const p of parts) execFileSync('rm', [p])
  console.log(`micwatch pronto em ${out}`)
}

function win() {
  const out = join('resources', 'bin', 'micwatch.exe')
  const windir = process.env.WINDIR ?? 'C:\\Windows'
  const csc = [join(windir, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'), join(windir, 'Microsoft.NET', 'Framework', 'v4.0.30319', 'csc.exe')].find(existsSync)
  if (!csc) throw new Error('csc.exe do .NET Framework 4 não encontrado.')
  execFileSync(csc, ['/nologo', '/optimize+', '/target:exe', '/platform:anycpu', `/out:${out}`, join('native', 'win', 'micwatch.cs')], { stdio: 'inherit' })
  console.log(`micwatch pronto em ${out}`)
}

if (process.platform === 'darwin') mac()
else if (process.platform === 'win32') win()
