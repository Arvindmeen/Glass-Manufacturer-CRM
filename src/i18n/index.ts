import { useCallback } from 'react'
import { useSettings, type Lang } from '../store/settings'
import { de } from './de'
import { en, type TKey } from './en'

const dicts: Record<Lang, Record<TKey, string>> = { en, de }

export type T = (key: TKey, vars?: Record<string, string | number>) => string

export function translate(lang: Lang, key: TKey, vars?: Record<string, string | number>) {
  let s = dicts[lang][key] ?? en[key] ?? key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
  return s
}

export function useT(): T {
  const { lang } = useSettings()
  return useCallback((key, vars) => translate(lang, key, vars), [lang])
}

export function useLocale() {
  const { lang } = useSettings()
  return lang === 'de' ? 'de-CH' : 'en-GB'
}

export type { TKey }
