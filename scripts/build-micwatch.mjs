// Compila o helper do Mac que diz quais apps estão usando o microfone.
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'

if (process.platform !== 'darwin') process.exit(0)
mkdirSync('resources/bin', { recursive: true })
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
