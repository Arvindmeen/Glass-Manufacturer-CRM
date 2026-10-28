import { useSyncExternalStore } from 'react'

/** Records the assistant just created or changed; pages make them glow briefly. */
let recent = new Set<string>()
const listeners = new Set<() => void>()
let timer: number | undefined

export function markRecent(ids: string[], ms = 4500) {
  recent = new Set(ids)
  listeners.forEach((l) => l())
  // Bring the first highlighted entry into view (it may be below the fold on a phone).
  requestAnimationFrame(() => document.querySelector('.flash')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    recent = new Set()
    listeners.forEach((l) => l())
  }, ms)
}

export function useRecent() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => recent,
  )
}

/** Class for a record that should glow ("" when not recent). */
export const flash = (set: Set<string>, id: string) => (set.has(id) ? ' flash' : '')
