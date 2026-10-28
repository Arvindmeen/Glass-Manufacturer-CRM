/**
 * Browser-side vault for the OpenAI API key.
 *
 * - The key is encrypted with AES-256-GCM before it touches storage.
 * - The AES key is a non-extractable WebCrypto key kept in IndexedDB: script can ask the
 *   browser to use it, but its raw bytes can never be read, exported or copied to another
 *   machine. A copied storage dump is useless.
 * - The plaintext lives only in this module's memory, is never put into React state,
 *   localStorage, logs or the DOM, and is only ever sent to api.openai.com (see openai.ts).
 *
 * Limit (by design of a backend-free prototype): code running on this origin while the app
 * is open can use the key. The CSP in vercel.json / vite.config.ts blocks foreign scripts;
 * the production plan moves the key to the server.
 */

const DB_NAME = 'glasscrm-vault'
const STORE = 'vault'
const WRAP_ID = 'wrap-key'
const SECRET_ID = 'openai'
const LEGACY_SETTINGS = 'glasscrm:settings:v1'

/** Accepts OpenAI secret keys (sk-…, sk-proj-…) and nothing else. */
export const KEY_PATTERN = /^sk-[A-Za-z0-9_-]{20,}$/

let plaintext: string | null = null
let memoryOnly = false
const listeners = new Set<() => void>()
let status: { hasKey: boolean; hint: string; persistent: boolean } = { hasKey: false, hint: '', persistent: true }

function notify() {
  status = { hasKey: !!plaintext, hint: plaintext ? `sk-…${plaintext.slice(-4)}` : '', persistent: !memoryOnly }
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

async function wrapKey(): Promise<CryptoKey> {
  const existing = await idb<CryptoKey | undefined>('readonly', (s) => s.get(WRAP_ID))
  if (existing) return existing
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  await idb('readwrite', (s) => s.put(key, WRAP_ID))
  return key
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
    const record = await idb<{ iv: Uint8Array; data: ArrayBuffer } | undefined>('readonly', (s) => s.get(SECRET_ID))
    if (record) {
      const key = await wrapKey()
      const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: record.iv as BufferSource }, key, record.data)
      plaintext = new TextDecoder().decode(clear)
    } else if (legacy) {
      await saveKey(legacy)
    }
  } catch {
    // IndexedDB/WebCrypto unavailable (e.g. some private modes): keep the key for this tab only.
    memoryOnly = true
  }
  notify()
  return 'done' as const
}

export async function saveKey(raw: string) {
  const value = raw.trim()
  if (!KEY_PATTERN.test(value)) throw new Error('invalid-key')
  plaintext = value
  try {
    const key = await wrapKey()
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value))
    await idb('readwrite', (s) => s.put({ iv, data }, SECRET_ID))
    memoryOnly = false
  } catch {
    memoryOnly = true
  }
  notify()
}

export async function removeKey() {
  plaintext = null
  try {
    await idb('readwrite', (s) => s.delete(SECRET_ID))
  } catch {
    // nothing stored
  }
  notify()
}

/** Only openai.ts calls this, right before a request to api.openai.com. */
export function keyForRequest(): string | null {
  return plaintext
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
