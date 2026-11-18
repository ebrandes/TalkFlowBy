import { createContext, useContext } from 'react'
import { dict, langFromLocale, type Dict, type Lang } from '../../shared/i18n'

const I18n = createContext<Dict>(dict(langFromLocale(navigator.language)))

/** Antes das configurações carregarem, usa o idioma do navegador/sistema. */
export function guessLang(): Lang {
  return langFromLocale(navigator.language)
}

export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }): React.JSX.Element {
  return <I18n.Provider value={dict(lang)}>{children}</I18n.Provider>
}

export function useT(): Dict {
  return useContext(I18n)
}
