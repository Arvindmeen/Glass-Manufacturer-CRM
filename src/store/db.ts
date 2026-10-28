import { useSyncExternalStore } from 'react'
import type { Company, DB, Email, ID, KnowledgeEntry, Meeting, Person, Task } from '../types'
import { todayISO } from '../lib/format'
import { seed } from './seed'

const KEY = 'glasscrm:db:v1'
export const STORAGE_FULL = 'glasscrm:storage-full'

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const data = JSON.parse(raw) as Partial<DB>
      const fresh = seed()
      // Keep valid collections, fall back to seed for missing or malformed ones.
      return Object.fromEntries(
        (Object.keys(fresh) as (keyof DB)[]).map((k) => [k, Array.isArray(data[k]) ? data[k] : fresh[k]]),
      ) as unknown as DB
    }
  } catch {
    // fall through to seed data
  }
  return seed()
}

let state: DB = load()
const listeners = new Set<() => void>()

function commit(next: DB) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Storage full or blocked: keep the in-memory state and tell the user.
    window.dispatchEvent(new Event(STORAGE_FULL))
  }
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useDB(): DB {
  return useSyncExternalStore(subscribe, () => state)
}

export function getDB(): DB {
  return state
}

export const uid = () => crypto.randomUUID()
const now = () => new Date().toISOString()

type Collection = keyof DB
type Item<C extends Collection> = DB[C][number]

function upsert<C extends Collection>(col: C, item: Item<C>) {
  const list = state[col] as Item<C>[]
  const exists = list.some((x) => x.id === item.id)
  const next = exists ? list.map((x) => (x.id === item.id ? item : x)) : [item, ...list]
  commit({ ...state, [col]: next })
  return item
}

function remove<C extends Collection>(col: C, id: ID) {
  commit({ ...state, [col]: (state[col] as Item<C>[]).filter((x) => x.id !== id) })
}

export const blankCompany = (patch: Partial<Company> = {}): Company => ({
  id: uid(),
  name: '',
  industry: '',
  street: '',
  zip: '',
  city: '',
  phone: '',
  email: '',
  website: '',
  notes: '',
  createdAt: now(),
  ...patch,
})

export const blankPerson = (patch: Partial<Person> = {}): Person => ({
  id: uid(),
  firstName: '',
  lastName: '',
  role: '',
  phone: '',
  email: '',
  notes: '',
  companyIds: [],
  createdAt: now(),
  ...patch,
})

export const blankMeeting = (patch: Partial<Meeting> = {}): Meeting => ({
  id: uid(),
  date: todayISO(),
  title: '',
  summary: '',
  companyIds: [],
  personIds: [],
  createdAt: now(),
  ...patch,
})

export const blankTask = (patch: Partial<Task> = {}): Task => ({
  id: uid(),
  title: '',
  due: '',
  status: 'planned',
  createdAt: now(),
  ...patch,
})

export const saveCompany = (c: Company) => upsert('companies', c)
export const savePerson = (p: Person) => upsert('people', p)
export const saveMeeting = (m: Meeting) => upsert('meetings', m)
export const saveTask = (t: Task) => upsert('tasks', t)
export const saveKnowledge = (k: KnowledgeEntry) => upsert('knowledge', k)
export const saveEmail = (e: Email) => upsert('emails', e)

export function deleteCompany(id: ID) {
  commit({
    ...state,
    companies: state.companies.filter((c) => c.id !== id),
    people: state.people.map((p) => ({ ...p, companyIds: p.companyIds.filter((x) => x !== id) })),
    meetings: state.meetings.map((m) => ({ ...m, companyIds: m.companyIds.filter((x) => x !== id) })),
    tasks: state.tasks.map((t) => (t.companyId === id ? { ...t, companyId: undefined } : t)),
  })
}

export function deletePerson(id: ID) {
  commit({
    ...state,
    people: state.people.filter((p) => p.id !== id),
    meetings: state.meetings.map((m) => ({ ...m, personIds: m.personIds.filter((x) => x !== id) })),
    tasks: state.tasks.map((t) => (t.personId === id ? { ...t, personId: undefined } : t)),
  })
}

export const deleteMeeting = (id: ID) => remove('meetings', id)
export const deleteTask = (id: ID) => remove('tasks', id)
export const deleteKnowledge = (id: ID) => remove('knowledge', id)

export function appendNotes(col: 'companies' | 'people', id: ID, text: string) {
  const list = state[col] as (Company | Person)[]
  const item = list.find((x) => x.id === id)
  if (!item) return
  const notes = item.notes ? `${item.notes}\n${text}` : text
  upsert(col, { ...item, notes } as Item<typeof col>)
}

export function linkPersonCompany(personId: ID, companyId: ID, linked: boolean) {
  const p = state.people.find((x) => x.id === personId)
  if (!p) return
  const ids = new Set(p.companyIds)
  if (linked) ids.add(companyId)
  else ids.delete(companyId)
  savePerson({ ...p, companyIds: [...ids] })
}

export function resetDemoData() {
  commit(seed())
}

export const fullName = (p: Pick<Person, 'firstName' | 'lastName'>) =>
  `${p.firstName} ${p.lastName}`.trim()
