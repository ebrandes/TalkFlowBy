import { en, type Dict } from './en'
import { pt } from './pt'

export type Lang = 'en' | 'pt'
export type { Dict }

export const DICTS: Record<Lang, Dict> = { en, pt }

export const LANGS: { value: Lang; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'pt', label: 'Português (Brasil)' }
]

/** Portuguese for pt-* systems, English everywhere else. */
export function langFromLocale(locale: string | undefined): Lang {
  return (locale ?? '').toLowerCase().startsWith('pt') ? 'pt' : 'en'
}

export function dict(lang: Lang | undefined): Dict {
  return DICTS[lang ?? 'en'] ?? en
}
