import { useEffect, useRef, useState } from 'react'
import { Loader2, MessageCircle, Send } from 'lucide-react'
import { useT } from '../i18n'
import { aiErrorMessage } from '../lib/aiError'
import { ask, clarify, type Choice } from '../lib/assistant'
import { getDB } from '../store/db'
import { checkInput, GuardError } from '../lib/guard'
import type { ChatMessage } from '../lib/openai'
import { Sheet, useClosing } from './ui'

/* The Ask chat lives in the layout, so every page can open it and the conversation survives navigation. */

const OPEN = 'glasscrm:open-chat'
export const openChat = () => window.dispatchEvent(new Event(OPEN))
export function onOpenChat(fn: () => void) {
  window.addEventListener(OPEN, fn)
  return () => window.removeEventListener(OPEN, fn)
}

/** Ask button shown next to every page's "+" button. */
export function AskButton() {
  const t = useT()
  return (
    <button className="btn fab-alt" onClick={openChat}>
      <MessageCircle size={18} /> {t('kb.chat')}
    </button>
  )
}

// Kept for this browser tab only (survives reloads, cleared when the tab closes).
/**
 * A chat bubble. `choices` turn it into a "which one do you mean?" prompt answered on the device;
 * `local` bubbles and `asked` questions are never sent to the model (the clarified question is).
 */
type Msg = ChatMessage & { choices?: Choice[]; picked?: string; local?: boolean; asked?: boolean; ai?: string }

const HISTORY = 'glasscrm:chat'
const loadHistory = (): Msg[] => {
  try {
    const v = JSON.parse(sessionStorage.getItem(HISTORY) ?? '[]') as Msg[]
    return Array.isArray(v) ? v.filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').slice(-40) : []
  } catch {
    return []
  }
}
let chatHistory: Msg[] = loadHistory()

export function ChatSheet({ onClose }: { onClose: () => void }) {
  const t = useT()
  const [closing, close] = useClosing(onClose)
  const [messages, setMessages] = useState<Msg[]>(chatHistory)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const body = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatHistory = messages
    try {
      sessionStorage.setItem(HISTORY, JSON.stringify(messages.slice(-40)))
    } catch {
      // storage blocked: keep in memory
    }
    body.current?.scrollTo({ top: body.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  /** What the model sees: real questions (clarified ones with the chosen name) and its answers. */
  const forModel = (list: Msg[]): ChatMessage[] =>
    list
      .filter((m, i) => !m.local && !m.asked && !m.content.startsWith('⚠') && !list[i + 1]?.content.startsWith('⚠'))
      .map((m) => ({ role: m.role, content: m.ai ?? m.content }))

  const answer = async (list: Msg[]) => {
    setMessages(list)
    setBusy(true)
    try {
      const reply = await ask(forModel(list))
      setMessages([...list, { role: 'assistant', content: reply }])
    } catch (e) {
      setMessages([...list, { role: 'assistant', content: `⚠ ${aiErrorMessage(e, t)}` }])
    } finally {
      setBusy(false)
    }
  }

  const send = async (text: string) => {
    const q = text.trim()
    if (!q || busy) return
    setInput('')
    const refused = checkInput(q)
    if (refused) {
      setMessages([...messages, { role: 'user', content: q }, { role: 'assistant', content: `⚠ ${aiErrorMessage(new GuardError(refused), t)}` }])
      return
    }
    // Partial or misspelled name: offer the matching names first (no details), before asking the model.
    const choices = clarify(getDB(), q)
    if (choices) {
      setMessages([
        ...messages,
        { role: 'user', content: q, asked: true },
        { role: 'assistant', content: t(choices.length === 1 ? 'chat.didYouMean' : 'chat.whichOne'), choices, local: true },
      ])
      return
    }
    await answer([...messages, { role: 'user', content: q }])
  }

  /** The user picked a record: ask the original question again with the full name. */
  const pick = async (index: number, choice: Choice) => {
    const prompt = messages[index]
    const question = messages[index - 1]?.content ?? ''
    if (!prompt || busy) return
    const list = messages.map((m, i) => (i === index ? { ...m, picked: choice.id } : m))
    await answer([...list, { role: 'user', content: choice.label, ai: `${question} — I mean ${choice.label} (${choice.sub}).` }])
  }

  return (
    <Sheet
      title={t('kb.chat')}
      onClose={close}
      closing={closing}
      wide
      height="78dvh"
      bodyRef={body}
      footer={
        <form
          className="chat-input"
          onSubmit={(e) => {
            e.preventDefault()
            void send(input)
          }}
        >
          <input
            className="input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('kb.chatPlaceholder')}
            enterKeyHint="send"
          />
          <button className="btn primary icon" type="submit" disabled={!input.trim() || busy} aria-label={t('kb.chat')}>
            <Send size={18} />
          </button>
        </form>
      }
    >
      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.content}
            {m.choices && (
              <div className="choices">
                {m.choices.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`choice${m.picked === c.id ? ' picked' : ''}`}
                    disabled={!!m.picked || busy}
                    onClick={() => void pick(i, c)}
                  >
                    <span className="choice-label">{c.label}</span>
                    {c.sub && <span className="choice-sub">{c.sub}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="bubble assistant">
            <Loader2 size={16} className="spin" />
          </div>
        )}
      </div>
    </Sheet>
  )
}
