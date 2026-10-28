import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ChevronRight, Loader2, MessageCircle, Mic, Pencil, Plus, Send } from 'lucide-react'
import { openAssistant } from '../lib/assistantBus'
import { useT } from '../i18n'
import { ask } from '../lib/assistant'
import { matches } from '../lib/format'
import { aiErrorMessage } from '../lib/aiError'
import { checkInput, GuardError } from '../lib/guard'
import type { ChatMessage } from '../lib/openai'
import { useDB } from '../store/db'
import type { KnowledgeEntry } from '../types'
import { blankKnowledge, KnowledgeForm, SECTIONS, sectionLabel } from '../components/KnowledgeForm'
import { StepImage } from '../components/StepImage'
import { PageHead, SearchInput, Sheet, toast, useClosing, useSearchQuery } from '../components/ui'
import { flash, useRecent } from '../lib/recent'
import { VoiceRecorder } from '../components/VoiceRecorder'

export function KnowledgePage() {
  return (
    <Routes>
      <Route index element={<KnowledgeList />} />
      <Route path="chat" element={<Navigate to="/knowledge" replace />} />
      <Route path=":id" element={<KnowledgeView />} />
    </Routes>
  )
}

function KnowledgeList() {
  const t = useT()
  const navigate = useNavigate()
  const { knowledge } = useDB()
  const [q, setQ] = useSearchQuery()
  const recent = useRecent()
  const [params, setParams] = useSearchParams()
  const section = params.get('section') ?? ''
  const setSection = (s: string) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        if (s) n.set('section', s)
        else n.delete('section')
        return n
      },
      { replace: true },
    )
  const [draft, setDraft] = useState<KnowledgeEntry | null>(null)
  const [chatOpen, setChatOpen] = useState(false)

  const list = knowledge
    .filter((k) => !section || k.section === section)
    .filter((k) => matches(q, k.title, k.product, k.summary, k.tags.join(' ')))
    .sort((a, b) => a.title.localeCompare(b.title))

  return (
    <>
      <PageHead
        title={t('nav.knowledge')}
        fabs={
          <>
            <button className="btn fab-alt" onClick={() => setChatOpen(true)}>
              <MessageCircle size={18} /> {t('kb.chat')}
            </button>
            <button className="btn icon fab-mic" onClick={openAssistant} aria-label={t('kb.record')}>
              <Mic size={20} />
            </button>
            <button className="btn primary icon fab-main" onClick={() => setDraft(blankKnowledge())} aria-label={t('common.add')}>
              <Plus size={22} />
            </button>
          </>
        }
      />


      <div className="section">
        <SearchInput value={q} onChange={setQ} placeholder={t('kb.searchProduct')} />
        <div className="chips" style={{ marginBottom: 12 }}>
          {['', ...SECTIONS].map((s) => (
            <button key={s} className={`chip${section === s ? ' primary' : ''}`} style={{ padding: '6px 12px', border: 0, cursor: 'pointer' }} onClick={() => setSection(s)}>
              {t(s ? sectionLabel(s) : 'kb.all')}
            </button>
          ))}
        </div>
        <div className="list">
          {list.length === 0 && <div className="empty">{t('common.none')}</div>}
          {list.map((k) => (
            <button key={k.id} className={`list-item${flash(recent, k.id)}`} onClick={() => navigate(`/knowledge/${k.id}`)}>
              <div className="grow">
                <div className="title">{k.title}</div>
                <div className="sub">{[k.product, t(sectionLabel(k.section))].filter(Boolean).join(' · ')}</div>
              </div>
              {k.steps.length > 0 && <span className="chip">{k.steps.length}</span>}
              <ChevronRight size={18} className="muted" />
            </button>
          ))}
        </div>
      </div>

      {chatOpen && <ChatSheet onClose={() => setChatOpen(false)} />}
      {draft && (
        <KnowledgeForm
          entry={draft}
          isNew
          onClose={() => setDraft(null)}
          onSaved={(k) => navigate(`/knowledge/${k.id}`)}
        />
      )}
    </>
  )
}

function KnowledgeView() {
  const t = useT()
  const navigate = useNavigate()
  const { id } = useParams()
  const { knowledge } = useDB()
  const [editing, setEditing] = useState(false)
  const entry = knowledge.find((k) => k.id === id)
  if (!entry) return <Navigate to="/knowledge" replace />

  return (
    <>
      <PageHead title={entry.title} back>
        <button className="btn ghost icon" onClick={() => setEditing(true)} aria-label={t('common.edit')}>
          <Pencil size={18} />
        </button>
      </PageHead>
      <div className="chips" style={{ marginBottom: 10 }}>
        <Link to={`/knowledge?section=${entry.section}`} className="chip primary chip-link">
          {t(sectionLabel(entry.section))}
        </Link>
        {entry.product && (
          <Link to={`/knowledge?q=${encodeURIComponent(entry.product)}`} className="chip chip-link">
            {entry.product}
          </Link>
        )}
        {entry.tags.map((tag) => (
          <Link key={tag} to={`/knowledge?q=${encodeURIComponent(tag)}`} className="chip chip-link">
            {tag}
          </Link>
        ))}
      </div>
      {entry.summary && <p style={{ marginTop: 0 }}>{entry.summary}</p>}
      {entry.steps.length > 0 && (
        <ol className="steps">
          {entry.steps.map((s, i) => (
            <li key={i} className="card">
              <StepImage n={i + 1} caption={s.image} photo={s.photo} />
              <div className="step-text">
                <strong>{t('kb.step', { n: i + 1 })}</strong>
                <p>{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {editing && (
        <KnowledgeForm
          entry={entry}
          isNew={false}
          onClose={() => setEditing(false)}
          onDeleted={() => navigate('/knowledge', { replace: true })}
        />
      )}
    </>
  )
}

/* ---------- chat ---------- */

let chatHistory: ChatMessage[] = []

function ChatSheet({ onClose }: { onClose: () => void }) {
  const t = useT()
  const [closing, close] = useClosing(onClose)
  const [messages, setMessages] = useState<ChatMessage[]>(chatHistory)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [recording, setRecording] = useState(false)
  const body = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatHistory = messages
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
          <VoiceRecorder
            variant="icon"
            onText={send}
            onError={toast}
            onActiveChange={setRecording}
          />
          {!recording && (
            <input
              className="input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('kb.chatPlaceholder')}
              enterKeyHint="send"
            />
          )}
          {!recording && (
            <button className="btn primary icon" type="submit" disabled={!input.trim() || busy} aria-label={t('kb.chat')}>
              <Send size={18} />
            </button>
          )}
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
