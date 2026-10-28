import { getSettings } from '../store/settings'

const BASE = 'https://api.openai.com/v1'
export const CHAT_MODEL = 'gpt-4o-mini'
const TRANSCRIBE_MODELS = ['gpt-4o-mini-transcribe', 'whisper-1']

export class MissingKeyError extends Error {
  constructor() {
    super('missing-key')
  }
}

function key() {
  const k = getSettings().openaiKey
  if (!k) throw new MissingKeyError()
  return k
}

async function failure(res: Response) {
  let msg = `${res.status}`
  try {
    const body = (await res.json()) as { error?: { message?: string } }
    if (body.error?.message) msg = body.error.message
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
  const k = key()
  let lastError: Error | undefined
  for (const model of TRANSCRIBE_MODELS) {
    const form = new FormData()
    form.append('file', audio, `voice.${extFor(audio.type)}`)
    form.append('model', model)
    const res = await fetch(`${BASE}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${k}` },
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
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json' },
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
