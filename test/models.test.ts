import { describe, expect, it } from 'vitest'
import { WHISPER_MODELS, defaultQuality } from '../src/shared/models'

describe('qualidade da transcrição', () => {
  it('modelo grande no Mac com chip Apple, equilibrado no resto', () => {
    expect(defaultQuality('darwin', 'arm64')).toBe('best')
    expect(defaultQuality('darwin', 'x64')).toBe('balanced')
    expect(defaultQuality('win32', 'x64')).toBe('balanced')
  })

  it('só o modelo grande usa a decodificação mais cuidadosa', () => {
    expect(WHISPER_MODELS.best.greedy).toBe(false)
    expect(WHISPER_MODELS.balanced.greedy).toBe(true)
    expect(WHISPER_MODELS.fast.sizeMb).toBeLessThan(WHISPER_MODELS.balanced.sizeMb)
  })
})
