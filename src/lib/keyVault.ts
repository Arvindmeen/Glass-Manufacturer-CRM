/**
 * Browser-side vault for the OpenAI API key.
 *
 * - At rest: AES-256-GCM, bound to this app (additional data), under a non-extractable WebCrypto
 *   key in IndexedDB. Script can ask the browser to use that key but can never read, export or
 *   copy its bytes, so a copied storage dump or disk image is useless on another machine.
 *   Every save makes a fresh key; deleting destroys it, so old copies can never be decrypted.
 * - "Until I close the browser" keeps the encrypted key in sessionStorage only: closing the
 *   browser (or tab) leaves nothing behind.
 * - In memory: the key stays encrypted under a second key that exists only in this page's memory.
 *   It is decrypted for a moment inside `vaultFetch`, put into the Authorization header and dropped.
 * - The key never leaves this module: no getter, no hint in the UI, never in React state, the DOM,
 *   localStorage, logs or URLs. `vaultFetch` only talks to https://api.openai.com, with the
 *   browser's own fetch captured before any other code runs.
 *
 * Limit (by design of a backend-free prototype): code running on this origin while the app is open
 * can make OpenAI requests through the vault. The CSP in vercel.json blocks foreign scripts;
 * the production plan moves the key to a server so the browser never holds it.
 */

const DB_NAME = 'glasscrm-vault'
const STORE = 'vault'
const WRAP_ID = 'wrap-key'
const SECRET_ID = 'openai'
const SESSION_ID = 'glasscrm:vault'
const LEGACY_SETTINGS = 'glasscrm:settings:v1'
const API_ORIGIN = 'https://api.openai.com'
/** Binds the ciphertext to this app and format; it cannot be replayed into another context. */
const AAD = new TextEncoder().encode(`glasscrm-vault-v2|${location.origin}`)

/** Accepts OpenAI secret keys (sk-…, sk-proj-…) and nothing else. */
export const KEY_PATTERN = /^sk-[A-Za-z0-9_-]{20,}$/

export type KeyMode = 'device' | 'session'

// Captured at load, so a later override of window.fetch can never see the header.
const nativeFetch = window.fetch.bind(window)

/* ---------- in-memory copy (encrypted under a key that never leaves this page) ---------- */

let memKey: Promise<CryptoKey> | null = null
const memoryKey = () =>
  (memKey ??= crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']))
let sealed: { iv: Uint8Array; data: ArrayBuffer } | null = null

async function seal(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, await memoryKey(), new TextEncoder().encode(value))
  sealed = { iv, data }
}

async function unseal(): Promise<string | null> {
  if (!sealed) return null
  const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv as BufferSource, additionalData: AAD }, await memoryKey(), sealed.data)
  return new TextDecoder().decode(clear)
}

/* ---------- status for the UI (no part of the key) ---------- */

let mode: KeyMode = 'device'
let memoryOnly = false
const listeners = new Set<() => void>()
let status: { hasKey: boolean; mode: KeyMode; persistent: boolean } = { hasKey: false, mode, persistent: true }

function notify() {
  status = { hasKey: !!sealed, mode, persistent: !memoryOnly }
  listeners.forEach((l) => l())
}

export const subscribeVault = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
export const vaultStatus = () => status

/* ---------- IndexedDB helpers ---------- */

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDB()
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE))
      req.onsuccess = () => resolve(req.result as T)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

const storedWrapKey = () => idb<CryptoKey | undefined>('readonly', (s) => s.get(WRAP_ID))

async function newWrapKey(): Promise<CryptoKey> {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  await idb('readwrite', (s) => s.put(key, WRAP_ID))
  return key
}

interface StoredSecret {
  iv: Uint8Array
  data: ArrayBuffer
  v?: number
}

const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b))
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

function readSession(): StoredSecret | null {
  try {
    const raw = sessionStorage.getItem(SESSION_ID)
    if (!raw) return null
    const v = JSON.parse(raw) as { iv: string; data: string }
    return { iv: fromB64(v.iv), data: fromB64(v.data).buffer as ArrayBuffer, v: 2 }
  } catch {
    return null
  }
}

async function decryptRecord(record: StoredSecret, key: CryptoKey) {
  // Records from before v2 were stored without additional data.
  const params: AesGcmParams = { name: 'AES-GCM', iv: record.iv as BufferSource, ...(record.v === 2 ? { additionalData: AAD } : {}) }
  return new TextDecoder().decode(await crypto.subtle.decrypt(params, key, record.data))
}

/* ---------- public API ---------- */

/** Load and decrypt the stored key once at startup. Never throws, never blocks longer than ~1.5 s. */
export async function initVault() {
  const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 1500))
  if ((await Promise.race([loadVault(), timeout])) === 'timeout') memoryOnly = true
  notify()
}

async function loadVault() {
  try {
    const legacy = readLegacyKey()
    const session = readSession()
    const record = session ?? (await idb<StoredSecret | undefined>('readonly', (s) => s.get(SECRET_ID)))
    const key = record && (await storedWrapKey())
    if (record && key) {
      const value = await decryptRecord(record, key)
      mode = session ? 'session' : 'device'
      if (KEY_PATTERN.test(value)) await seal(value)
      // Upgrade older records to the bound v2 format.
      if (!session && record.v !== 2) await saveKey(value, 'device')
    } else if (legacy) {
      await saveKey(legacy, 'device')
    }
  } catch {
    // IndexedDB/WebCrypto unavailable (e.g. some private modes): keep the key for this tab only.
    memoryOnly = true
  }
  notify()
  return 'done' as const
}

export async function saveKey(raw: string, keyMode: KeyMode = mode) {
  const value = raw.trim()
  if (!KEY_PATTERN.test(value)) throw new Error('invalid-key')
  await seal(value)
  mode = keyMode
  try {
    // A fresh wrapping key on every save: whatever was stored before can never be decrypted again.
    const key = await newWrapKey()
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, key, new TextEncoder().encode(value))
    if (keyMode === 'session') {
      await idb('readwrite', (s) => s.delete(SECRET_ID))
      sessionStorage.setItem(SESSION_ID, JSON.stringify({ iv: toB64(iv), data: toB64(new Uint8Array(data)) }))
    } else {
      sessionStorage.removeItem(SESSION_ID)
      await idb('readwrite', (s) => s.put({ iv, data, v: 2 }, SECRET_ID))
    }
    memoryOnly = false
  } catch {
    memoryOnly = true
  }
  notify()
}

/** Switch between "remember on this device" and "until I close the browser" without re-typing. */
export async function setKeyMode(next: KeyMode) {
  const value = await unseal()
  if (value) await saveKey(value, next)
  else {
    mode = next
    notify()
  }
}

export async function removeKey() {
  sealed = null
  try {
    sessionStorage.removeItem(SESSION_ID)
  } catch {
    // storage blocked
  }
  try {
    // Destroying the wrapping key makes any leftover copy of the ciphertext undecryptable.
    await idb('readwrite', (s) => s.delete(SECRET_ID))
    await idb('readwrite', (s) => s.delete(WRAP_ID))
  } catch {
    // nothing stored
  }
  notify()
}

export class MissingKeyError extends Error {
  constructor() {
    super('missing-key')
  }
}

/**
 * The only way to use the key: a request to the OpenAI API. The key is decrypted here,
 * added as the Authorization header and goes out of scope when the request is sent.
 */
export async function vaultFetch(url: string, init: RequestInit & { headers?: Record<string, string> }) {
  if (new URL(url).origin !== API_ORIGIN) throw new Error('blocked-origin')
  const key = await unseal()
  if (!key) throw new MissingKeyError()
  return nativeFetch(url, {
    ...init,
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    cache: 'no-store',
    mode: 'cors',
    redirect: 'error',
    headers: { ...init.headers, Authorization: `Bearer ${key}` },
  })
}

/** Earlier versions kept the key in localStorage in plain text: move it into the vault and wipe it. */
function readLegacyKey(): string | null {
  try {
    const raw = localStorage.getItem(LEGACY_SETTINGS)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { openaiKey?: string }
    if (!parsed.openaiKey) return null
    const { openaiKey, ...rest } = parsed
    localStorage.setItem(LEGACY_SETTINGS, JSON.stringify(rest))
    return KEY_PATTERN.test(openaiKey) ? openaiKey : null
  } catch {
    return null
  }
}
