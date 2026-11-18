import { describe, expect, it } from 'vitest'
import { followUiLanguage, repairedLanguage } from '../src/main/language'

describe('idioma das reuniões', () => {
  it('acompanha o idioma do app quando ainda seguia o anterior', () => {
    expect(followUiLanguage({ uiLanguage: 'en', language: 'en' }, { uiLanguage: 'pt' })).toEqual({ uiLanguage: 'pt', language: 'pt' })
  })

  it('respeita uma escolha feita à mão', () => {
    expect(followUiLanguage({ uiLanguage: 'en', language: 'es' }, { uiLanguage: 'pt' })).toEqual({ uiLanguage: 'pt' })
    expect(followUiLanguage({ uiLanguage: 'en', language: 'auto' }, { uiLanguage: 'pt' })).toEqual({ uiLanguage: 'pt' })
    expect(followUiLanguage({ uiLanguage: 'en', language: 'en' }, { uiLanguage: 'pt', language: 'en' })).toEqual({ uiLanguage: 'pt', language: 'en' })
    expect(followUiLanguage({ uiLanguage: 'en', language: 'en' }, { keepAudio: true })).toEqual({ keepAudio: true })
    expect(followUiLanguage({ uiLanguage: 'pt', language: 'pt' }, { uiLanguage: 'en' })).toEqual({ uiLanguage: 'en' })
  })

  it('corrige quem trocou o app para português num sistema em inglês (0.2.0)', () => {
    expect(repairedLanguage({ uiLanguage: 'pt', language: 'en' }, { ui: 'en', language: 'en' })).toBe('pt')
  })

  it('não mexe em quem não trocou o app ou escolheu outro idioma', () => {
    expect(repairedLanguage({ uiLanguage: 'en', language: 'es' }, { ui: 'en', language: 'es' })).toBeNull()
    expect(repairedLanguage({ uiLanguage: 'pt', language: 'pt' }, { ui: 'pt', language: 'pt' })).toBeNull()
    expect(repairedLanguage({ uiLanguage: 'pt', language: 'auto' }, { ui: 'en', language: 'en' })).toBeNull()
    // App em inglês com reuniões em português (ex.: quem pratica inglês) fica como está.
    expect(repairedLanguage({ uiLanguage: 'en', language: 'pt' }, { ui: 'pt', language: 'pt' })).toBeNull()
  })
})
