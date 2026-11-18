import type { Settings, UiLang } from '../shared/types'

type Langs = Pick<Settings, 'uiLanguage' | 'language'>

/**
 * Trocar o idioma do app leva junto o idioma das reuniões, se ele ainda seguia o anterior.
 * Sem isso, quem tem o Windows em inglês e escolhe português continua com `-l en` no Whisper,
 * que traduz a reunião para o inglês em vez de transcrever.
 *
 * Só acompanha quando o app sai do inglês: muita gente usa o app em inglês (para praticar, por
 * costume) com reuniões em português, e aí mudar o idioma das reuniões criaria o mesmo erro ao contrário.
 */
export function followUiLanguage<T extends Partial<Settings>>(current: Langs, patch: T): T {
  if (!patch.uiLanguage || patch.uiLanguage === 'en') return patch
  if (patch.language !== undefined || patch.uiLanguage === current.uiLanguage) return patch
  if (current.language !== current.uiLanguage) return patch
  return { ...patch, language: patch.uiLanguage }
}

/**
 * Até a 0.2.0, trocar o idioma do app não mudava o das reuniões: quem tinha o sistema em inglês
 * e passou o app para português ficou transcrevendo com `-l en`. Devolve o idioma certo para quem
 * trocou o do app e nunca mexeu no das reuniões; `null` quando não há o que corrigir.
 */
export function repairedLanguage(stored: Partial<Langs>, system: { ui: UiLang; language: string }): string | null {
  // Mesmo motivo de `followUiLanguage`: app em inglês não diz nada sobre o idioma das reuniões.
  if (!stored.uiLanguage || !stored.language || stored.uiLanguage === 'en') return null
  const switchedUi = stored.uiLanguage !== system.ui
  if (!switchedUi || stored.language !== system.language || stored.language === stored.uiLanguage) return null
  return stored.uiLanguage
}
