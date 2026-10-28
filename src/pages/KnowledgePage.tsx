import { useEffect, useRef, useState } from 'react'
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, Loader2, MessageCircle, Mic, Pencil, Plus, Send } from 'lucide-react'
import { useT } from '../i18n'
import { ask } from '../lib/assistant'
import { matches } from '../lib/format'
import { MissingKeyError, type ChatMessage } from '../lib/openai'
import { useDB } from '../store/db'
import type { KnowledgeEntry } from '../types'
import { blankKnowledge, KnowledgeForm, SECTIONS, sectionLabel, structureKnowledge } from '../components/KnowledgeForm'
import { StepImage } from '../components/StepImage'
import { PageHead, SearchInput, toast } from '../components/ui'
import { VoiceRecorder } from '../components/VoiceRecorder'

export function KnowledgePage() {
  return (
    <Routes>
      <Route index element={<KnowledgeList />} />
      <Route path="chat" element={<KnowledgeChat />} />
      <Route path=":id" element={<KnowledgeView />} />
    </Routes>
  )
}

function KnowledgeList() {
  const t = useT()
  const navigate = useNavigate()
  const { knowledge } = useDB()
  const [q, setQ] = useState('')
  const [section, setSection] = useState<string>('')
  const [draft, setDraft] = useState<KnowledgeEntry | null>(null)

  const list = knowledge
    .filter((k) => !section || k.section === section)
    .filter((k) => matches(q, k.title, k.product, k.summary, k.tags.join(' ')))
    .sort((a, b) => a.title.localeCompare(b.title))

  return (
    <>
      <PageHead title={t('nav.knowledge')}>
        <button className="btn icon" onClick={() => setDraft(blankKnowledge())} aria-label={t('common.add')}>
          <Plus size={20} />
        </button>
        <button className="btn primary" onClick={() => navigate('/knowledge/chat')}>
          <MessageCircle size={18} /> {t('kb.chat')}
        </button>
      </PageHead>

      <VoiceRecorder big label={t('kb.record')} onText={async (text) => setDraft(await structureKnowledge(text))} />

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
            <button key={k.id} className="list-item" onClick={() => navigate(`/knowledge/${k.id}`)}>
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
        <span className="chip primary">{t(sectionLabel(entry.section))}</span>
        {entry.product && <span className="chip">{entry.product}</span>}
        {entry.tags.map((tag) => (
          <span key={tag} className="chip">
            #{tag}
          </span>
        ))}
      </div>
      {entry.summary && <p style={{ marginTop: 0 }}>{entry.summary}</p>}
      {entry.steps.length > 0 && (
        <ol className="steps">
          {entry.steps.map((s, i) => (
            <li key={i} className="card">
              <StepImage n={i + 1} caption={s.image} />
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

function KnowledgeChat() {
  const t = useT()
  const [messages, setMessages] = useState<ChatMessage[]>(chatHistory)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatHistory = messages
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, busy])

  const send = async (text: string) => {
    const q = text.trim()
    if (!q || busy) return
    const next: ChatMessage[] = [...messages, { role: 'user', content: q }]
    setMessages(next)
    setInput('')
    setBusy(true)
    try {
      const answer = await ask(next)
      setMessages([...next, { role: 'assistant', content: answer }])
    } catch (e) {
      const msg = e instanceof MissingKeyError ? t('voice.noKey') : t('voice.error', { msg: (e as Error).message })
      setMessages([...next, { role: 'assistant', content: `⚠ ${msg}` }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="chat">
      <PageHead title={t('kb.chat')} back />
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
        <div ref={end} />
      </div>
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault()
          void send(input)
        }}
      >
        <VoiceMini onText={send} />
        <input className="input" value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('kb.chatPlaceholder')} />
        <button className="btn primary icon" type="submit" disabled={!input.trim() || busy} aria-label={t('kb.chat')}>
          <Send size={18} />
        </button>
      </form>
    </div>
  )
}

/** Mic button that sends the transcript as a chat question. */
function VoiceMini({ onText }: { onText: (text: string) => Promise<void> }) {
  const [on, setOn] = useState(false)
  return on ? (
    <span style={{ display: 'none' }}>
      <VoiceRecorder
        autoStart
        onText={async (text) => {
          setOn(false)
          await onText(text)
        }}
        onCancel={() => setOn(false)}
        onError={(msg) => {
          setOn(false)
          toast(msg)
        }}
      />
    </span>
  ) : (
    <button type="button" className="btn icon" onClick={() => setOn(true)} aria-label="Mic">
      <Mic size={18} />
    </button>
  )
}
