import { checkOutput, GUARD_RULES, GuardError, hasForeignScript, languageRule, takeRateSlot } from './guard'
import { getSettings } from '../store/settings'
import { fullName, getDB } from '../store/db'
import { MissingKeyError, vaultFetch, vaultStatus } from './keyVault'

/** The key never leaves the vault: requests go through vaultFetch, which only talks to this origin. */
const BASE = 'https://api.openai.com/v1'
export const CHAT_MODEL = 'gpt-4o-mini'
const TRANSCRIBE_MODELS = ['gpt-4o-mini-transcribe', 'whisper-1']

export { MissingKeyError }

function requireKey() {
  if (!vaultStatus().hasKey) throw new MissingKeyError()
}

async function failure(res: Response) {
  let msg = `${res.status}`
  try {
    const body = (await res.json()) as { error?: { message?: string } }
    // OpenAI echoes part of a wrong key in its message; never show any of it.
    if (body.error?.message) msg = body.error.message.replace(/sk-[\w*.-]+/g, 'sk-…')
  } catch {
    // keep status text
  }
  return new Error(msg)
}

function extFor(type: string) {
  if (type.includes('mp4') || type.includes('aac') || type.includes('m4a')) return 'm4a'
  if (type.includes('ogg')) return 'ogg'
  if (type.includes('wav')) return 'wav'
  return 'webm'
}

export async function transcribe(audio: Blob): Promise<string> {
  requireKey()
  takeRateSlot()
  let lastError: Error | undefined
  for (const model of TRANSCRIBE_MODELS) {
    const form = new FormData()
    form.append('file', audio, `voice.${extFor(audio.type)}`)
    form.append('model', model)
    // Any spoken language is accepted (detected automatically); CRM names help spell names right.
    // The answer is always written in English or German (see languageRule).
    form.append('prompt', vocabulary())
    const res = await vaultFetch(`${BASE}/audio/transcriptions`, {
      method: 'POST',
      body: form,
    })
    if (res.ok) return ((await res.json()) as { text: string }).text.trim()
    lastError = await failure(res)
    if (res.status === 401) break
  }
  throw lastError ?? new Error('transcription failed')
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function chat(messages: ChatMessage[], opts: { json?: boolean; temperature?: number } = {}) {
  // Every request carries the security and language rules at the end of its system message.
  const rules = GUARD_RULES + languageRule(getSettings().lang)
  const guarded = messages.map((m, i) => (i === 0 && m.role === 'system' ? { ...m, content: m.content + rules } : m))
  if (guarded[0]?.role !== 'system') guarded.unshift({ role: 'system', content: rules.trim() })
  let reply = await complete(guarded, opts)
  if (hasForeignScript(reply)) {
    // One retry with an explicit correction; never show another language or script.
    const lang = getSettings().lang === 'de' ? 'German' : 'English'
    reply = await complete([...guarded, { role: 'system', content: `Your previous answer used a language other than English or German. Answer again, only in ${lang}.` }], opts)
    if (hasForeignScript(reply)) throw new GuardError('language')
  }
  // Replies that leak instructions, secrets or bulk personal data never reach the screen.
  if (!checkOutput(reply)) throw new GuardError('blocked')
  return reply
}

async function complete(messages: ChatMessage[], opts: { json?: boolean; temperature?: number }) {
  requireKey()
  takeRateSlot()
  const res = await vaultFetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages,
      temperature: opts.temperature ?? 0.2,
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
    }),
  })
  if (!res.ok) throw await failure(res)
  const body = (await res.json()) as { choices: { message: { content: string } }[] }
  return body.choices[0]?.message.content ?? ''
}

/** Names from the CRM as spelling hints for speech recognition (kept short). */
function vocabulary() {
  const db = getDB()
  const names = [...db.companies.map((c) => c.name), ...db.people.map(fullName)]
  return `CRM for a Swiss glass manufacturer. Names: ${names.join(', ')}`.slice(0, 800)
}

/** AI JSON is untrusted: turn any value into a trimmed string ("" for objects, null, …). */
export const text = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')

export async function chatJSON<T>(system: string, user: string): Promise<T> {
  const text = await chat(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { json: true },
  )
  return JSON.parse(text) as T
}
