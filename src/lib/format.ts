export function formatDate(iso: string, locale: string, opts: Intl.DateTimeFormatOptions = {}) {
  if (!iso) return ''
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', ...opts })
}

/** YYYY-MM-DD in the device's time zone (toISOString would give the UTC date). */
export const localISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const todayISO = () => localISO(new Date())

export function dueState(due: string): 'overdue' | 'today' | 'soon' | '' {
  if (!due) return ''
  const today = todayISO()
  if (due < today) return 'overdue'
  if (due === today) return 'today'
  return 'soon'
}

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()

export function matches(query: string, ...fields: (string | undefined)[]) {
  const q = normalize(query)
  if (!q) return true
  const hay = normalize(fields.filter(Boolean).join(' '))
  return q.split(/\s+/).every((w) => hay.includes(w))
}

export const mapsSearchUrl = (address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
