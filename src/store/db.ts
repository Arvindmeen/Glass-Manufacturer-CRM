import { useSyncExternalStore } from 'react'
import type { Company, DB, Email, ID, KnowledgeEntry, Meeting, Person, Task } from '../types'
import { todayISO } from '../lib/format'
import { seed } from './seed'

const KEY = 'glasscrm:db:v1'
const REV_KEY = 'glasscrm:db:rev'
export const STORAGE_FULL = 'glasscrm:storage-full'

/*
 * Persistence: every change is written at once to IndexedDB (large quota, photos fit) and, while it
 * fits, to localStorage (synchronous, survives an immediate reload). Each write carries a revision;
 * on start the newest copy wins. Open tabs share changes over a BroadcastChannel, so a tab with old
 * data can never overwrite newer changes made in another tab.
 */
const IDB_NAME = 'glasscrm-data'
const IDB_STORE = 'db'
const IDB_ID = 'state'

function normalizeDB(data: Partial<DB> | null | undefined): DB {
  const fresh = seed()
  if (!data || typeof data !== 'object') return fresh
  // Keep valid collections, fall back to seed for missing or malformed ones.
  return Object.fromEntries(
    (Object.keys(fresh) as (keyof DB)[]).map((k) => [k, Array.isArray(data[k]) ? data[k] : fresh[k]]),
  ) as unknown as DB
}

function loadLocal(): { db: DB; rev: number } | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { db: normalizeDB(JSON.parse(raw) as Partial<DB>), rev: Number(localStorage.getItem(REV_KEY)) || 0 }
  } catch {
    // fall through
  }
  return null
}

const local = loadLocal()
let state: DB = local?.db ?? seed()
let rev = local?.rev ?? 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
let idb: Promise<IDBDatabase> | null = null
const getIDB = () => (idb ??= openIDB())

/** Writes are queued, so they land in the order they were made. */
let queue: Promise<unknown> = Promise.resolve()
function writeIDB(db: DB, r: number) {
  queue = queue
    .then(() => getIDB())
    .then(
      (d) =>
        new Promise<void>((resolve, reject) => {
          const tx = d.transaction(IDB_STORE, 'readwrite')
          tx.objectStore(IDB_STORE).put({ rev: r, db }, IDB_ID)
          tx.oncomplete = () => resolve()
          tx.onerror = tx.onabort = () => reject(tx.error)
        }),
    )
    .catch(() => {
      if (!localOk) window.dispatchEvent(new Event(STORAGE_FULL))
    })
}

let localOk = true
function writeLocal(db: DB, r: number) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
    localStorage.setItem(REV_KEY, String(r))
    localOk = true
  } catch {
    // Too big for localStorage (e.g. photos): IndexedDB holds the data; drop the old copy so it never wins.
    localOk = false
    try {
      localStorage.removeItem(KEY)
      localStorage.setItem(REV_KEY, String(r))
    } catch {
      // storage blocked
    }
  }
}

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('glasscrm:db') : null
channel?.addEventListener('message', (e: MessageEvent<{ rev: number; db: DB }>) => {
  if (!e.data || e.data.rev <= rev) return
  rev = e.data.rev
  state = normalizeDB(e.data.db)
  emit()
})

const storedRev = () => {
  try {
    return Number(localStorage.getItem(REV_KEY)) || 0
  } catch {
    return 0
  }
}

const readIDB = () =>
  getIDB()
    .then(
      (d) =>
        new Promise<{ rev: number; db: DB } | undefined>((resolve, reject) => {
          const req = d.transaction(IDB_STORE).objectStore(IDB_STORE).get(IDB_ID)
          req.onsuccess = () => resolve(req.result as { rev: number; db: DB } | undefined)
          req.onerror = () => reject(req.error)
        }),
    )
    .catch(() => undefined)

/** Take over a newer copy saved by another tab (e.g. this tab was in the background or frozen). */
async function resync() {
  if (storedRev() <= rev) return
  const fromLocal = loadLocal()
  const saved = fromLocal && fromLocal.rev > rev ? fromLocal : await readIDB()
  if (saved && saved.rev > rev) {
    rev = saved.rev
    state = 'db' in saved ? normalizeDB(saved.db) : state
    emit()
  }
}
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void resync())
window.addEventListener('pageshow', () => void resync())

/** Load the newest saved copy before the first render. Never throws, never waits longer than ~1.5 s. */
export async function initDB() {
  const timeout = new Promise<undefined>((r) => setTimeout(() => r(undefined), 1500))
  const saved = await Promise.race([readIDB(), timeout])
  if (saved && saved.rev > rev) {
    rev = saved.rev
    state = normalizeDB(saved.db)
    emit()
  } else if (!saved || saved.rev < rev) {
    writeIDB(state, rev) // first run or localStorage is newer: bring IndexedDB up to date
  }
  // Ask the browser not to evict the data under storage pressure.
  void navigator.storage?.persist?.().catch(() => undefined)
}

function commit(next: DB) {
  state = next
  rev = Math.max(rev, storedRev()) + 1
  writeLocal(state, rev)
  writeIDB(state, rev)
  channel?.postMessage({ rev, db: state })
  emit()
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
