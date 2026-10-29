import { useEffect, useRef, useState } from 'react'
import { Loader2, MessageCircle, Send } from 'lucide-react'
import { useT } from '../i18n'
import { aiErrorMessage } from '../lib/aiError'
import { ask } from '../lib/assistant'
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
const HISTORY = 'glasscrm:chat'
const loadHistory = (): ChatMessage[] => {
  try {
    const v = JSON.parse(sessionStorage.getItem(HISTORY) ?? '[]') as ChatMessage[]
    return Array.isArray(v) ? v.filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').slice(-40) : []
  } catch {
    return []
  }
}
let chatHistory: ChatMessage[] = loadHistory()

export function ChatSheet({ onClose }: { onClose: () => void }) {
  const t = useT()
  const [closing, close] = useClosing(onClose)
  const [messages, setMessages] = useState<ChatMessage[]>(chatHistory)
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

  const send = async (text: string) => {
    const q = text.trim()
    if (!q || busy) return
    const next: ChatMessage[] = [...messages, { role: 'user', content: q }]
    setMessages(next)
    setInput('')
    setBusy(true)
    try {
      const refused = checkInput(q)
      if (refused) throw new GuardError(refused)
      // Refused or failed exchanges (marked ⚠) are never sent back to the model.
      const answer = await ask(next.filter((m, i) => !m.content.startsWith('⚠') && !next[i + 1]?.content.startsWith('⚠')))
      setMessages([...next, { role: 'assistant', content: answer }])
    } catch (e) {
      const msg = aiErrorMessage(e, t)
      setMessages([...next, { role: 'assistant', content: `⚠ ${msg}` }])
    } finally {
      setBusy(false)
    }
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
