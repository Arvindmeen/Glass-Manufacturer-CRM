import { useSyncExternalStore } from 'react'

export type Lang = 'de' | 'en'

export interface Settings {
  openaiKey: string
  lang: Lang
}

const KEY = 'glasscrm:settings:v1'

function load(): Settings {
  const fallback: Settings = { openaiKey: '', lang: 'en' }
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...fallback, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    // ignore
  }
  return fallback
}

let settings = load()
const listeners = new Set<() => void>()

export function updateSettings(patch: Partial<Settings>) {
  settings = { ...settings, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
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
