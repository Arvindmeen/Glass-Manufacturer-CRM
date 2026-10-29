import type { Company, DB, Email, KnowledgeEntry, KnowledgeStep, Meeting, Person, QuoteRequest, Task } from '../types'

/*
 * Stored data comes from the browser (older versions, other tabs, manual edits), so it is never trusted:
 * every record is coerced to its type with safe defaults, and anything without an id is dropped.
 * A broken record then shows as empty fields instead of crashing the whole app.
 */

type Raw = Record<string, unknown>

const str = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x) : [])
const optId = (v: unknown) => (typeof v === 'string' && v ? v : undefined)
const isRecord = (v: unknown): v is Raw => !!v && typeof v === 'object' && !Array.isArray(v) && typeof (v as Raw).id === 'string' && !!(v as Raw).id

const company = (r: Raw): Company => ({
  id: str(r.id), name: str(r.name), industry: str(r.industry), street: str(r.street), zip: str(r.zip), city: str(r.city),
  phone: str(r.phone), email: str(r.email), website: str(r.website), lat: num(r.lat), lng: num(r.lng),
  notes: str(r.notes), createdAt: str(r.createdAt),
})

const person = (r: Raw): Person => ({
  id: str(r.id), firstName: str(r.firstName), lastName: str(r.lastName), role: str(r.role), phone: str(r.phone),
  email: str(r.email), notes: str(r.notes), companyIds: ids(r.companyIds), createdAt: str(r.createdAt),
})

const meeting = (r: Raw): Meeting => ({
  id: str(r.id), date: str(r.date), title: str(r.title), summary: str(r.summary),
  companyIds: ids(r.companyIds), personIds: ids(r.personIds), createdAt: str(r.createdAt),
})

const STATUS = ['planned', 'in_progress', 'done'] as const
const task = (r: Raw): Task => ({
  id: str(r.id), title: str(r.title), due: str(r.due),
  status: STATUS.find((s) => s === r.status) ?? 'planned',
  companyId: optId(r.companyId), personId: optId(r.personId), createdAt: str(r.createdAt),
})

const step = (v: unknown): KnowledgeStep | null => {
  if (!v || typeof v !== 'object') return typeof v === 'string' ? { text: v } : null
  const s = v as Raw
  return { text: str(s.text), ...(typeof s.image === 'string' ? { image: s.image } : {}), ...(typeof s.photo === 'string' ? { photo: s.photo } : {}) }
}

const knowledge = (r: Raw): KnowledgeEntry => ({
  id: str(r.id), section: str(r.section) || 'installation', title: str(r.title), product: str(r.product), summary: str(r.summary),
  steps: Array.isArray(r.steps) ? r.steps.map(step).filter((s): s is KnowledgeStep => !!s) : [],
  tags: Array.isArray(r.tags) ? r.tags.map(str).filter(Boolean) : [],
  createdAt: str(r.createdAt),
})

const quote = (v: unknown): QuoteRequest | undefined => {
  if (!v || typeof v !== 'object') return undefined
  const q = v as Raw
  return {
    customer: str(q.customer), contact: str(q.contact), notes: str(q.notes),
    items: Array.isArray(q.items)
      ? q.items.filter((i): i is Raw => !!i && typeof i === 'object').map((i) => ({ product: str(i.product), quantity: num(i.quantity) ?? (Number(i.quantity) || 0), dimensions: str(i.dimensions) }))
      : [],
  }
}

const email = (r: Raw): Email => ({
  id: str(r.id), fromName: str(r.fromName), fromEmail: str(r.fromEmail), subject: str(r.subject), body: str(r.body),
  date: str(r.date), read: r.read === true, isQuote: r.isQuote === true, quote: quote(r.quote),
  transferredAt: optId(r.transferredAt),
})

const CLEAN: { [K in keyof DB]: (r: Raw) => DB[K][number] } = { companies: company, people: person, meetings: meeting, tasks: task, knowledge, emails: email }

/** A clean copy of `data`; collections that are missing or not arrays come from `fallback`. */
export function sanitizeDB(data: unknown, fallback: DB): DB {
  const d = data && typeof data === 'object' ? (data as Raw) : {}
  const out = {} as Record<keyof DB, unknown[]>
  for (const k of Object.keys(CLEAN) as (keyof DB)[]) {
    const list = d[k]
    if (!Array.isArray(list)) {
      out[k] = fallback[k]
      continue
    }
    const seen = new Set<string>()
    out[k] = list.filter(isRecord).filter((r) => !seen.has(r.id as string) && !!seen.add(r.id as string)).map((r) => CLEAN[k](r))
  }
  return out as unknown as DB
}
