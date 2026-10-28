import { useState, type ReactNode } from 'react'
import { Building2, Calendar, Check, ListChecks, Pencil, Send, StickyNote, User, X } from 'lucide-react'
import { useLocale, useT } from '../i18n'
import { formatDate } from '../lib/format'
import { applyProposals, interpret, type Proposal, type Ref, type ReviewItem } from '../lib/interpret'
import { MissingKeyError } from '../lib/openai'
import { fullName, useDB } from '../store/db'
import { Field, Sheet, toast } from './ui'
import { VoiceOverlay } from './VoiceOverlay'
import { VoiceRecorder } from './VoiceRecorder'

const icons: Record<Proposal['kind'], ReactNode> = {
  create_company: <Building2 size={18} />,
  create_person: <User size={18} />,
  create_meeting: <Calendar size={18} />,
  create_task: <ListChecks size={18} />,
  add_note: <StickyNote size={18} />,
}

export function VoiceCommand({ onClose }: { onClose: () => void }) {
  const t = useT()
  const [items, setItems] = useState<ReviewItem[] | null>(null)
  const [transcript, setTranscript] = useState('')
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [typedRun, setTypedRun] = useState(false)

  const run = async (text: string, fromVoice = true) => {
    if (!text.trim()) return
    setTypedRun(!fromVoice)
    setTranscript(text)
    setBusy(true)
    setError('')
    try {
      setItems(await interpret(text))
    } catch (e) {
      setError(e instanceof MissingKeyError ? t('voice.noKey') : t('voice.error', { msg: (e as Error).message }))
    } finally {
      setBusy(false)
    }
  }

  const update = (key: string, patch: Partial<ReviewItem>) =>
    setItems((list) => list?.map((i) => (i.key === key ? { ...i, ...patch } : i)) ?? null)

  const acceptedCount = items?.filter((i) => i.accepted).length ?? 0

  if (!items) {
    return (
      <Sheet title={t('voice.start')} onClose={onClose}>
        <div className="stack">
          <VoiceRecorder big autoStart onText={run} onCancel={onClose} />
          {busy && typedRun && (
            <VoiceOverlay mode="processing" seconds={0} getLevel={() => 0} onDone={() => {}} onCancel={() => {}} />
          )}
          <form
            className="row-gap"
            style={{ flexWrap: 'nowrap' }}
            onSubmit={(e) => {
              e.preventDefault()
              void run(typed, false)
            }}
          >
            <input
              className="input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={t('voice.typeInstead')}
              disabled={busy}
            />
            <button className="btn icon" type="submit" disabled={busy || !typed.trim()} aria-label={t('common.done')}>
              <Send size={18} />
            </button>
          </form>
          {error && <span className="error">{error}</span>}
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet
      title={t('voice.review')}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={() => setItems(null)}>
            {t('common.back')}
          </button>
          <span className="grow" />
          <button
            className="btn primary"
            disabled={acceptedCount === 0}
            onClick={() => {
              applyProposals(items)
              toast(t('voice.saved'))
              onClose()
            }}
          >
            <Check size={18} /> {t('voice.saveAccepted', { n: acceptedCount })}
          </button>
        </>
      }
    >
      <p className="muted small" style={{ margin: '0 0 12px', fontStyle: 'italic' }}>
        “{transcript}”
      </p>
      {items.length === 0 && <div className="empty">{t('voice.nothing')}</div>}
      <div className="stack">
        {items.map((item) => (
          <ProposalCard key={item.key} item={item} items={items} onChange={(patch) => update(item.key, patch)} />
        ))}
      </div>
    </Sheet>
  )
}

/* ---------- one proposal ---------- */

function useRefs(items: ReviewItem[]) {
  const { companies, people } = useDB()
  const newCompanies = items.flatMap((i) => (i.proposal.kind === 'create_company' && i.accepted ? [i.proposal] : []))
  const newPeople = items.flatMap((i) => (i.proposal.kind === 'create_person' && i.accepted ? [i.proposal] : []))

  const label = (ref?: Ref) => {
    if (!ref) return ''
    const nc = newCompanies.find((c) => c.ref === ref)
    if (nc) return nc.name
    const np = newPeople.find((p) => p.ref === ref)
    if (np) return fullName(np)
    const c = companies.find((x) => x.id === ref)
    if (c) return c.name
    const p = people.find((x) => x.id === ref)
    return p ? fullName(p) : ''
  }

  const companyOptions = [
    ...newCompanies.map((c) => ({ value: c.ref, label: `${c.name} (+)` })),
    ...[...companies].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c.id, label: c.name })),
  ]
  const personOptions = [
    ...newPeople.map((p) => ({ value: p.ref, label: `${fullName(p)} (+)` })),
    ...[...people].sort((a, b) => a.lastName.localeCompare(b.lastName)).map((p) => ({ value: p.id, label: fullName(p) })),
  ]
  const isNewRef = (ref: Ref) => ref.startsWith('new:')
  return { label, companyOptions, personOptions, isNewRef }
}

function ProposalCard({
  item,
  items,
  onChange,
}: {
  item: ReviewItem
  items: ReviewItem[]
  onChange: (patch: Partial<ReviewItem>) => void
}) {
  const t = useT()
  const locale = useLocale()
  const [editing, setEditing] = useState(false)
  const refs = useRefs(items)
  const p = item.proposal
  const set = (patch: Partial<Proposal>) => onChange({ proposal: { ...p, ...patch } as Proposal })

  const chip = (r?: Ref) => <RefChip key={r} label={r ? refs.label(r) : ''} isNew={!!r && refs.isNewRef(r)} />

  let summary: ReactNode
  let form: ReactNode
  switch (p.kind) {
    case 'create_company':
      summary = (
        <>
          <div className="title">{p.name}</div>
          <div className="sub">{[p.street, [p.zip, p.city].filter(Boolean).join(' '), p.industry].filter(Boolean).join(' · ')}</div>
        </>
      )
      form = (
        <>
          <Field label={t('field.name')}>
            <input className="input" value={p.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <div className="row">
            <Field label={t('field.city')}>
              <input className="input" value={p.city} onChange={(e) => set({ city: e.target.value })} />
            </Field>
            <Field label={t('field.industry')}>
              <input className="input" value={p.industry} onChange={(e) => set({ industry: e.target.value })} />
            </Field>
          </div>
          <Field label={t('field.street')}>
            <input className="input" value={p.street} onChange={(e) => set({ street: e.target.value })} />
          </Field>
          <div className="row">
            <Field label={t('field.phone')}>
              <input className="input" value={p.phone} onChange={(e) => set({ phone: e.target.value })} />
            </Field>
            <Field label={t('field.email')}>
              <input className="input" value={p.email} onChange={(e) => set({ email: e.target.value })} />
            </Field>
          </div>
        </>
      )
      break
    case 'create_person':
      summary = (
        <>
          <div className="title">{fullName(p)}</div>
          <div className="sub">{p.role}</div>
          <div className="chips" style={{ marginTop: 6 }}>
            {p.companyRefs.map(chip)}
          </div>
        </>
      )
      form = (
        <>
          <div className="row">
            <Field label={t('field.firstName')}>
              <input className="input" value={p.firstName} onChange={(e) => set({ firstName: e.target.value })} />
            </Field>
            <Field label={t('field.lastName')}>
              <input className="input" value={p.lastName} onChange={(e) => set({ lastName: e.target.value })} />
            </Field>
          </div>
          <Field label={t('field.role')}>
            <input className="input" value={p.role} onChange={(e) => set({ role: e.target.value })} />
          </Field>
          <Field label={t('field.company')}>
            <RefSelect value={p.companyRefs[0]} options={refs.companyOptions} onChange={(v) => set({ companyRefs: v ? [v] : [] })} />
          </Field>
        </>
      )
      break
    case 'create_meeting':
      summary = (
        <>
          <div className="title">{p.title || formatDate(p.date, locale)}</div>
          <div className="sub">{formatDate(p.date, locale)}</div>
          <div className="small" style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{p.summary}</div>
          <div className="chips" style={{ marginTop: 6 }}>
            {[...p.companyRefs, ...p.personRefs].map(chip)}
          </div>
        </>
      )
      form = (
        <>
          <div className="row">
            <Field label={t('field.date')}>
              <input className="input" type="date" value={p.date} onChange={(e) => set({ date: e.target.value })} />
            </Field>
            <Field label={t('field.title')}>
              <input className="input" value={p.title} onChange={(e) => set({ title: e.target.value })} />
            </Field>
          </div>
          <Field label={t('field.summary')}>
            <textarea className="textarea" rows={4} value={p.summary} onChange={(e) => set({ summary: e.target.value })} />
          </Field>
          <div className="row">
            <Field label={t('field.company')}>
              <RefSelect value={p.companyRefs[0]} options={refs.companyOptions} onChange={(v) => set({ companyRefs: v ? [v] : [] })} />
            </Field>
            <Field label={t('field.person')}>
              <RefSelect value={p.personRefs[0]} options={refs.personOptions} onChange={(v) => set({ personRefs: v ? [v, ...p.personRefs.slice(1)] : p.personRefs.slice(1) })} />
            </Field>
          </div>
        </>
      )
      break
    case 'create_task':
      summary = (
        <>
          <div className="title">{p.title}</div>
          <div className="chips" style={{ marginTop: 6 }}>
            {p.due && <span className="chip warn">{formatDate(p.due, locale, { weekday: 'short' })}</span>}
            {chip(p.companyRef)}
            {chip(p.personRef)}
          </div>
        </>
      )
      form = (
        <>
          <Field label={t('field.title')}>
            <input className="input" value={p.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label={t('field.due')}>
            <input className="input" type="date" value={p.due} onChange={(e) => set({ due: e.target.value })} />
          </Field>
          <div className="row">
            <Field label={t('field.company')}>
              <RefSelect value={p.companyRef} options={refs.companyOptions} onChange={(v) => set({ companyRef: v })} />
            </Field>
            <Field label={t('field.person')}>
              <RefSelect value={p.personRef} options={refs.personOptions} onChange={(v) => set({ personRef: v })} />
            </Field>
          </div>
        </>
      )
      break
    case 'add_note':
      summary = (
        <>
          <div className="chips" style={{ marginBottom: 4 }}>
            {chip(p.targetRef)}
          </div>
          <div className="small" style={{ whiteSpace: 'pre-wrap' }}>{p.text}</div>
        </>
      )
      form = (
        <>
          <Field label={t('proposal.target')}>
            <RefSelect
              value={p.targetRef}
              options={[...refs.companyOptions, ...refs.personOptions].filter((o) => !o.value.startsWith('new:'))}
              onChange={(v) => v && set({ targetRef: v })}
            />
          </Field>
          <Field label={t('common.notes')}>
            <textarea className="textarea" value={p.text} onChange={(e) => set({ text: e.target.value })} />
          </Field>
        </>
      )
      break
  }

  return (
    <div className="card proposal" style={{ padding: 12, opacity: item.accepted ? 1 : 0.5 }}>
      <div className="spread" style={{ marginBottom: 6 }}>
        <span className="row-gap muted small" style={{ fontWeight: 600 }}>
          {icons[p.kind]} {t(`proposal.${p.kind}`)}
        </span>
        <div className="row-gap" style={{ gap: 4 }}>
          <button className="btn ghost icon small" onClick={() => setEditing((e) => !e)} aria-label={t('common.edit')}>
            <Pencil size={16} />
          </button>
          <button
            className={`btn icon small${item.accepted ? '' : ' danger'}`}
            onClick={() => onChange({ accepted: false })}
            aria-label={t('proposal.reject')}
            style={!item.accepted ? { background: '#fbe4e1', borderColor: 'transparent' } : undefined}
          >
            <X size={16} />
          </button>
          <button
            className={`btn icon small${item.accepted ? ' primary' : ''}`}
            onClick={() => onChange({ accepted: true })}
            aria-label={t('proposal.accept')}
          >
            <Check size={16} />
          </button>
        </div>
      </div>
      {editing && item.accepted ? <div className="form">{form}</div> : <div onClick={() => item.accepted && setEditing(true)}>{summary}</div>}
    </div>
  )
}

function RefChip({ label, isNew }: { label: string; isNew: boolean }) {
  if (!label) return null
  return <span className={`chip ${isNew ? 'ok' : 'primary'}`}>{isNew ? `+ ${label}` : label}</span>
}

function RefSelect({
  value,
  options,
  onChange,
}: {
  value?: string
  options: { value: string; label: string }[]
  onChange: (v: string | undefined) => void
}) {
  return (
    <select className="select" value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
      <option value="">—</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
