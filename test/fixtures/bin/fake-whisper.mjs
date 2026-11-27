#!/usr/bin/env node
// Faz de conta que é o whisper-cli: para cada wav, escreve o .json com uma frase.
import { writeFileSync } from 'node:fs'
const files = process.argv.slice(2).filter((a) => a.endsWith('.wav'))
for (const f of files) {
  process.stderr.write(`main: processing '${f}'\n`)
  const name = f.split(/[\\/]/).pop()
  writeFileSync(`${f}.json`, JSON.stringify({ transcription: [{ offsets: { from: 0, to: 1000 }, text: ` fala ${name}` }] }))
}
