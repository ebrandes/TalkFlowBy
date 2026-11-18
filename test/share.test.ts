import { describe, expect, it } from 'vitest'
import { claudeUrl, transcriptOf } from '../src/renderer/src/lib/share'

describe('enviar nota', () => {
  it('pega só a transcrição, em português ou inglês', () => {
    expect(transcriptOf('# A\n\n## Tópicos\n\n- x\n\n## Transcrição\n\n**[00:00] Você:** oi\n')).toBe('**[00:00] Você:** oi')
    expect(transcriptOf('# A\n\n## Transcript\n\n**[00:00] You:** hi\n\n## Extra\n\nz\n')).toBe('**[00:00] You:** hi')
    expect(transcriptOf('# Nota solta\n')).toBe('')
  })

  it('manda o texto no link só quando cabe', () => {
    expect(claudeUrl('oi & tchau')).toBe('https://claude.ai/new?q=oi%20%26%20tchau')
    expect(claudeUrl('x'.repeat(7000))).toBe('https://claude.ai/new')
  })
})
