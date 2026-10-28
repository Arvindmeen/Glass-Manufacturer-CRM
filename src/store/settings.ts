import { useSyncExternalStore } from 'react'

export type Lang = 'de' | 'en'

export interface Settings {
  openaiKey: string
  lang: Lang
}

const KEY = 'glasscrm:settings:v1'

/** German browsers get German; every other browser language falls back to English. */
export const browserLang = (): Lang => (navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en')

/** Stored shape: the language is kept only once the user picked one in Settings. */
interface Stored {
  openaiKey?: string
  chosenLang?: Lang
}

let stored: Stored = {}

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) stored = JSON.parse(raw) as Stored
  } catch {
    // ignore
  }
  const lang = stored.chosenLang === 'de' || stored.chosenLang === 'en' ? stored.chosenLang : browserLang()
  return { openaiKey: stored.openaiKey ?? '', lang }
}

let settings = load()
const listeners = new Set<() => void>()

export function updateSettings(patch: Partial<Settings>) {
  settings = { ...settings, ...patch }
  stored = { openaiKey: settings.openaiKey, chosenLang: patch.lang ?? stored.chosenLang }
  try {
    localStorage.setItem(KEY, JSON.stringify(stored))
  } catch {
    // ignore
  }
  document.documentElement.lang = settings.lang
  listeners.forEach((l) => l())
}

export function getSettings() {
  return settings
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => settings,
  )
}
