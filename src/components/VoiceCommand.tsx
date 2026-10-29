import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Building2,
  Calendar,
  Check,
  ExternalLink,
  ListChecks,
  MessageCircle,
  Mic,
  Navigation as NavIcon,
  Pencil,
  RefreshCw,
  Send,
  StickyNote,
  Trash2,
  User,
  X,
  Link2,
  Languages,
  CheckCheck,
} from 'lucide-react'
import { useLocale, useT, type TKey } from '../i18n'
import { formatDate } from '../lib/format'
import { isSafeImage } from '../lib/image'
import {
  applyProposals,
  interpret,
  navLabel,
  pathFor,
  replaceWithExisting,
  type AssistantResult,
  type PageKey,
  type Proposal,
  type Ref,
  type Decision,
  type ReviewItem,
  type Step,
  COMPANY_FIELDS,
  PERSON_FIELDS,
} from '../lib/interpret'
import { aiErrorMessage } from '../lib/aiError'
import { checkInput, GuardError } from '../lib/guard'
import { markRecent } from '../lib/recent'
import { fullName, getDB, useDB } from '../store/db'
import { updateSettings } from '../store/settings'
import type { TaskStatus } from '../types'
import { DatePicker, Select, type Option } from './Dropdown'
import { companyOptions as companyOptionsOf, personOptions as personOptionsOf } from './options'
import { ErrorText, Field, Sheet, useClosing } from './ui'
import { PhotoPicker } from './PhotoPicker'
import { VoiceBar } from './VoiceBar'
import { VoiceRecorder } from './VoiceRecorder'

const icons: Record<Proposal['kind'] | 'navigate' | 'language', ReactNode> = {
  create_company: <Building2 size={18} />,
  create_person: <User size={18} />,
  create_meeting: <Calendar size={18} />,
  create_task: <ListChecks size={18} />,
  update_task: <ListChecks size={18} />,
  update_meeting: <Calendar size={18} />,
  add_note: <StickyNote size={18} />,
  create_knowledge: <BookOpen size={18} />,
  delete_task: <Trash2 size={18} />,
  update_company: <Building2 size={18} />,
  update_person: <User size={18} />,
  link_person: <Link2 size={18} />,
  navigate: <NavIcon size={18} />,
  language: <Languages size={18} />,
}

const pageKeys: Record<PageKey, TKey> = {
  companies: 'nav.companies',
  companies_map: 'company.map',
  people: 'nav.people',
  tasks: 'nav.tasks',
  inbox: 'nav.inbox',
  knowledge: 'nav.knowledge',
  leads: 'nav.leads',
  simap: 'nav.simap',
  settings: 'nav.settings',
}

const sectionKey = (s: string): TKey =>
  (['installation', 'products', 'troubleshooting', 'sales'].includes(s) ? `kb.${s}` : 'kb.all') as TKey

/** Plain-language description of the open page, so "here" / "this company" can be resolved. */
function describePage(path: string): string {
  const db = getDB()
  const [, section, id] = path.split('/')
  if (section === 'companies' && id) return `company page of ${db.companies.find((c) => c.id === id)?.name} (id ${id})`
  if (section === 'people' && id) {
    const p = db.people.find((x) => x.id === id)
    return `person page of ${p ? fullName(p) : '?'} (id ${id}, companies ${p?.companyIds.join(',')})`
  }
  if (section === 'knowledge' && id) return `knowledge entry ${db.knowledge.find((k) => k.id === id)?.title} (id ${id})`
  if (section === 'knowledge') return 'knowledge base (spoken know-how should become a knowledge entry)'
  if (section === 'inbox' && id) return `email "${db.emails.find((e) => e.id === id)?.subject}" (id ${id})`
  return `${section || 'companies'} page`
}

type Phase = 'listen' | 'review' | 'done'

/**
 * The central assistant: speak (or type) anything. Data changes are proposed for review
 * (accept / edit / reject); navigation and answers need no confirmation. After saving, each
 * executed step is shown with a link, the app opens the right page and new entries glow there.
 */
export function VoiceCommand({ onClose }: { onClose: () => void }) {
  const t = useT()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [page] = useState(() => describePage(pathname))
  const [closing, close] = useClosing(onClose)
  const [phase, setPhase] = useState<Phase>('listen')
  const [result, setResult] = useState<AssistantResult | null>(null)
  const [items, setItems] = useState<ReviewItem[]>([])
  const [steps, setSteps] = useState<Step[]>([])
  const [transcript, setTranscript] = useState('')
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [typedRun, setTypedRun] = useState(false)
  const [error, setError] = useState('')
  const [photos, setPhotos] = useState<string[]>([])

  // Leaving the page by hand (e.g. the Settings link in an error) closes the assistant;
  // its own navigation happens in the "done" phase and keeps it open.
  const [openedAt] = useState(pathname)
  useEffect(() => {
    if (phase !== 'done' && pathname !== openedAt) close()
  }, [pathname, openedAt, phase, close])

  const pageName = (p: PageKey) => t(pageKeys[p])
  const navStep = (r: AssistantResult): Step | null =>
    r.navigate ? { kind: 'navigate', label: t('step.open', { name: navLabel(r.navigate, pageName) }), to: pathFor(r.navigate), highlight: [] } : null
  /** Steps that need no review: switch language, then open the target. */
  const commandSteps = (r: AssistantResult | null): Step[] => {
    if (!r) return []
    const out: Step[] = []
    if (r.language) {
      updateSettings({ lang: r.language })
      out.push({ kind: 'language', label: `${t('settings.language')} · ${r.language === 'de' ? 'Deutsch' : 'English'}`, highlight: [] })
    }
    const nav = navStep(r)
    if (nav) out.push(nav)
    return out
  }

  /** Attached photos go onto the steps of a new knowledge entry (extra photos become extra steps). */
  const withPhotos = (list: ReviewItem[]): ReviewItem[] => {
    if (!photos.length) return list
    let used = false
    const out = list.map((i) => {
      if (used || i.proposal.kind !== 'create_knowledge') return i
      used = true
      const steps = [...i.proposal.steps]
      photos.forEach((photo, n) => (steps[n] = { text: steps[n]?.text ?? '', photo }))
      return { ...i, proposal: { ...i.proposal, steps } }
    })
    return out
  }

  const finish = (done: Step[]) => {
    setSteps(done)
    setPhase('done')
  }

  const run = async (text: string, fromVoice = true) => {
    if (!text.trim()) return
    setTypedRun(!fromVoice)
    setTranscript(text)
    setBusy(true)
    setError('')
    try {
      // Misuse attempts are refused here, before anything leaves the device.
      const refused = checkInput(text)
      if (refused) throw new GuardError(refused)
      const r = await interpret(text, page)
      setResult(r)
      setItems(withPhotos(r.items))
      // Also review when everything was already there, so the user sees it instead of a silent no-op.
      if (r.items.length || r.known.length) setPhase('review')
      // Nothing to change: just answer, switch language and/or open the page.
      else finish(commandSteps(r))
    } catch (e) {
      setError(aiErrorMessage(e, t))
    } finally {
      setBusy(false)
    }
  }

  const save = () => {
    const done = applyProposals(items, (k) => t(`proposal.${k}`))
    finish([...done, ...commandSteps(result)])
  }

  const reset = () => {
    setPhase('listen')
    setResult(null)
    setItems([])
    setSteps([])
    setTyped('')
    setPhotos([])
  }

  const update = (key: string, patch: Partial<ReviewItem>) =>
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)))
  const acceptedCount = items.filter((i) => i.decision === 'accepted').length
  const pendingCount = items.filter((i) => i.decision === 'pending').length
  const acceptAll = () => setItems((list) => list.map((i) => (i.decision === 'pending' ? { ...i, decision: 'accepted' } : i)))

  const answer = result?.answer ? (
    <div className="assistant-answer">
      <MessageCircle size={18} />
      <p>{result.answer}</p>
    </div>
  ) : null

  if (phase === 'listen') {
    return (
      <Sheet title={t('voice.assistant')} onClose={close} closing={closing}>
        <div className="stack">
          {busy && typedRun ? (
            <VoiceBar mode="processing" seconds={0} getLevel={() => 0} onDone={() => {}} onCancel={() => {}} />
          ) : (
            <VoiceRecorder big autoStart onText={run} onCancel={close} />
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
              enterKeyHint="send"
            />
            <PhotoPicker iconOnly multiple label={t('voice.attach')} onPhotos={(p) => setPhotos((x) => [...x, ...p].slice(0, 8))} />
            <button className="btn icon" type="submit" disabled={busy || !typed.trim()} aria-label={t('common.done')}>
              <Send size={18} />
            </button>
          </form>
          {photos.length > 0 && (
            <div className="photo-strip">
              {photos.map((src, i) => (
                <button key={i} type="button" className="step-thumb" onClick={() => setPhotos((x) => x.filter((_, k) => k !== i))} aria-label={t('kb.removePhoto')}>
                  <img src={src} alt="" />
                  <span>×</span>
                </button>
              ))}
            </div>
          )}
          <ErrorText msg={error} noKeyMsg={t('voice.noKey')} />
        </div>
      </Sheet>
    )
  }

  if (phase === 'done') {
    return (
      <Sheet
        title={t('voice.assistant')}
        onClose={close}
        closing={closing}
        footer={
          <>
            <button className="btn" onClick={reset}>
              <Mic size={16} /> {t('voice.again')}
            </button>
            <span className="grow" />
            <button className="btn primary" onClick={close}>
              {t('common.done')}
            </button>
          </>
        }
      >
        <p className="muted small transcript">“{transcript}”</p>
        {answer}
        <StepList
          steps={steps}
          onComplete={(target, highlight) => {
            if (!target) return markRecent(highlight)
            navigate(target)
            // Let the user see the page change behind the sheet, then reveal it and make new entries glow.
            window.setTimeout(() => {
              close()
              markRecent(highlight)
            }, 1100)
          }}
        />
      </Sheet>
    )
  }

  return (
    <Sheet
      title={t('voice.review')}
      onClose={close}
      closing={closing}
      wide
      footer={
        <>
          <button className="btn" onClick={reset} aria-label={t('voice.again')}>
            <RefreshCw size={16} />
          </button>
          <span className="grow" />
          {pendingCount > 1 && (
            <button className="btn" onClick={acceptAll}>
              <CheckCheck size={18} /> {t('proposal.acceptAll')}
            </button>
          )}
          {items.length > 0 ? (
            <button className="btn primary" disabled={acceptedCount === 0} onClick={save}>
              <Check size={18} /> {t('voice.saveAccepted', { n: acceptedCount })}
            </button>
          ) : (
            <button className="btn primary" onClick={() => (result?.navigate || result?.language ? finish(commandSteps(result)) : close())}>
              {t('common.done')}
            </button>
          )}
        </>
      }
    >
      <p className="muted small transcript">“{transcript}”</p>
      {answer}
      {!!result?.known.length && (
        <div className="known">
          <p className="known-head">
            <CheckCheck size={18} />
            {items.length ? t('voice.knownSome', { n: result.known.length }) : t('voice.knownAll')}
          </p>
          <ul>
            {result.known.map((k, i) => (
              <li key={i}>
                <Link to={k.to} onClick={close}>
                  {icons[k.kind]}
                  <span className="grow">{k.label}</span>
                  <span className="chip ok">{t('proposal.existing')}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="stack">
        {items.map((item) => (
          <ProposalCard
            key={item.key}
            item={item}
            items={items}
            onChange={(patch) => update(item.key, patch)}
            onUseExisting={(ref, id) => setItems(replaceWithExisting(items, ref, id))}
          />
        ))}
        {result?.navigate && (
          <div className="card proposal nav-proposal">
            <span className="row-gap muted small" style={{ fontWeight: 600 }}>
              {icons.navigate} {t('step.open', { name: navLabel(result.navigate, pageName) })}
            </span>
          </div>
        )}
      </div>
    </Sheet>
  )
}

/* ---------- executed steps, revealed one after another ---------- */

const STEP_MS = 420

function StepList({ steps, onComplete }: { steps: Step[]; onComplete: (target: string | undefined, highlight: string[]) => void }) {
  const [shown, setShown] = useState(0)

  useEffect(() => {
    if (shown >= steps.length) return
    const id = window.setTimeout(() => setShown((n) => n + 1), shown === 0 ? 150 : STEP_MS)
    return () => window.clearTimeout(id)
  }, [shown, steps.length])

  // When every step is visible, report where the work landed (once).
  const reported = useRef(false)
  useEffect(() => {
    if (shown !== steps.length || steps.length === 0 || reported.current) return
    reported.current = true
    const target = steps.find((s) => s.kind === 'navigate')?.to ?? steps.find((s) => s.kind !== 'update_task' && s.to)?.to ?? steps[0]?.to
    onComplete(target, steps.flatMap((s) => s.highlight))
  }, [shown, steps, onComplete])

  return (
    <ol className="steps-run">
      {steps.slice(0, shown).map((s, i) => (
        <li key={i} className="step-run">
          <span className="step-icon">{icons[s.kind]}</span>
          <span className="grow">{s.label}</span>
          {s.to ? (
            <Link to={s.to} className="btn ghost icon small" aria-label={s.label}>
              <ExternalLink size={16} />
            </Link>
          ) : null}
          <span className="step-check">
            <Check size={16} strokeWidth={3} />
          </span>
        </li>
      ))}
      {shown < steps.length && <li className="step-run pending" aria-hidden />}
    </ol>
  )
}

/* ---------- one proposal ---------- */

function useRefs(items: ReviewItem[]) {
  const { companies, people } = useDB()
  const newCompanies = items.flatMap((i) => (i.proposal.kind === 'create_company' && i.decision !== 'rejected' ? [i.proposal] : []))
  const newPeople = items.flatMap((i) => (i.proposal.kind === 'create_person' && i.decision !== 'rejected' ? [i.proposal] : []))

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
    ...companyOptionsOf(companies),
  ]
  const personOptions = [
    ...newPeople.map((p) => ({ value: p.ref, label: `${fullName(p)} (+)` })),
    ...personOptionsOf(people, companies),
  ]
  const isNewRef = (ref: Ref) => ref.startsWith('new:')
  return { label, companyOptions, personOptions, isNewRef }
}

function ProposalCard({
  item,
  items,
  onChange,
  onUseExisting,
}: {
  item: ReviewItem
  items: ReviewItem[]
  onChange: (patch: Partial<ReviewItem>) => void
  onUseExisting: (ref: Ref, existingId: string) => void
}) {
  const t = useT()
  const locale = useLocale()
  const [editing, setEditing] = useState(false)
  const refs = useRefs(items)
  const { tasks, companies, people, meetings } = useDB()
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
          <Field label={t('field.company')} group>
            <RefSelect label={t('field.company')} value={p.companyRefs[0]} options={refs.companyOptions} onChange={(v) => set({ companyRefs: v ? [v] : [] })} />
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
            <Field label={t('field.date')} group>
              <DatePicker label={t('field.date')} value={p.date} onChange={(date) => set({ date })} />
            </Field>
            <Field label={t('field.title')}>
              <input className="input" value={p.title} onChange={(e) => set({ title: e.target.value })} />
            </Field>
          </div>
          <Field label={t('field.summary')}>
            <textarea className="textarea" rows={4} value={p.summary} onChange={(e) => set({ summary: e.target.value })} />
          </Field>
          <div className="row">
            <Field label={t('field.company')} group>
              <RefSelect label={t('field.company')} value={p.companyRefs[0]} options={refs.companyOptions} onChange={(v) => set({ companyRefs: v ? [v] : [] })} />
            </Field>
            <Field label={t('field.person')} group>
              <RefSelect label={t('field.person')} value={p.personRefs[0]} options={refs.personOptions} onChange={(v) => set({ personRefs: v ? [v, ...p.personRefs.slice(1)] : p.personRefs.slice(1) })} />
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
            <span className="chip">{t(`task.${p.status}`)}</span>
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
          <div className="row">
            <Field label={t('field.due')} group>
              <DatePicker label={t('field.due')} value={p.due} onChange={(due) => set({ due })} clearable quick />
            </Field>
            <Field label={t('field.status')} group>
              <Select
                label={t('field.status')}
                value={p.status}
                options={(['planned', 'in_progress', 'done'] as const).map((x) => ({ value: x, label: t(`task.${x}`) }))}
                onChange={(v) => v && set({ status: v as TaskStatus })}
              />
            </Field>
          </div>
          <div className="row">
            <Field label={t('field.company')} group>
              <RefSelect label={t('field.company')} value={p.companyRef} options={refs.companyOptions} onChange={(v) => set({ companyRef: v })} />
            </Field>
            <Field label={t('field.person')} group>
              <RefSelect label={t('field.person')} value={p.personRef} options={refs.personOptions} onChange={(v) => set({ personRef: v })} />
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
          <Field label={t('proposal.target')} group>
            <RefSelect label={t('proposal.target')}
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
    case 'create_knowledge':
      summary = (
        <>
          <div className="title">{p.title}</div>
          <div className="sub">{[p.product, t(sectionKey(p.section))].filter(Boolean).join(' · ')}</div>
          {p.summary && <div className="small" style={{ marginTop: 4 }}>{p.summary}</div>}
          {p.steps.length > 0 && (
            <ol className="small kb-steps-preview">
              {p.steps.filter((st) => st.text).map((st, i) => (
                <li key={i}>{st.text}</li>
              ))}
            </ol>
          )}
          {p.steps.some((st) => st.photo) && (
            <div className="photo-strip" style={{ marginTop: 8 }}>
              {p.steps.filter((st) => isSafeImage(st.photo)).map((st, i) => (
                <span key={i} className="step-thumb">
                  <img src={st.photo} alt="" />
                </span>
              ))}
            </div>
          )}
        </>
      )
      form = (
        <>
          <div className="row">
            <Field label={t('kb.section')} group>
              <Select
                label={t('kb.section')}
                value={p.section}
                options={['installation', 'products', 'troubleshooting', 'sales'].map((x) => ({ value: x, label: t(sectionKey(x)) }))}
                onChange={(v) => v && set({ section: v })}
              />
            </Field>
            <Field label={t('kb.product')}>
              <input className="input" value={p.product} onChange={(e) => set({ product: e.target.value })} />
            </Field>
          </div>
          <Field label={t('field.title')}>
            <input className="input" value={p.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label={t('kb.summary')}>
            <textarea className="textarea" rows={2} value={p.summary} onChange={(e) => set({ summary: e.target.value })} />
          </Field>
          <Field label={t('kb.steps')}>
            <textarea
              className="textarea"
              rows={Math.max(3, p.steps.length + 1)}
              value={p.steps.map((st) => st.text).join('\n')}
              onChange={(e) =>
                set({ steps: e.target.value.split('\n').map((text, i) => ({ text, photo: p.steps[i]?.photo })) })
              }
            />
          </Field>
        </>
      )
      break
    case 'delete_task': {
      const task = tasks.find((x) => x.id === p.taskId)
      summary = <div className="title" style={{ textDecoration: 'line-through' }}>{task?.title}</div>
      form = summary
      break
    }
    case 'update_company':
    case 'update_person': {
      const keys = p.kind === 'update_company' ? COMPANY_FIELDS : PERSON_FIELDS
      const record = (p.kind === 'update_company' ? companies.find((c) => c.id === p.companyId) : people.find((x) => x.id === p.personId)) as
        | Record<string, unknown>
        | undefined
      const name = p.kind === 'update_company' ? (record?.name as string) : record ? fullName(record as never) : ''
      const fields = p.fields as Record<string, string>
      const setField = (k: string, v: string) => set({ fields: { ...fields, [k]: v } } as Partial<Proposal>)
      summary = (
        <>
          <div className="title">{name}</div>
          <div className="field-changes">
            {Object.entries(fields).map(([k, v]) => (
              <div key={k} className="small">
                <span className="muted">{t(`field.${k}` as TKey)}:</span> {record?.[k] ? <s className="muted">{String(record[k])}</s> : null} <strong>{v}</strong>
              </div>
            ))}
          </div>
        </>
      )
      form = (
        <>
          {keys
            .filter((k) => k in fields)
            .map((k) => (
              <Field key={k} label={t(`field.${k}` as TKey)}>
                <input className="input" value={fields[k] ?? ''} onChange={(e) => setField(k, e.target.value)} />
              </Field>
            ))}
        </>
      )
      break
    }
    case 'link_person':
      summary = (
        <div className="chips">
          {chip(p.personRef)} → {chip(p.companyRef)}
        </div>
      )
      form = (
        <div className="row">
          <Field label={t('field.person')} group>
            <RefSelect label={t('field.person')} value={p.personRef} options={refs.personOptions} onChange={(v) => v && set({ personRef: v })} />
          </Field>
          <Field label={t('field.company')} group>
            <RefSelect label={t('field.company')} value={p.companyRef} options={refs.companyOptions} onChange={(v) => v && set({ companyRef: v })} />
          </Field>
        </div>
      )
      break
    case 'update_meeting': {
      const meeting = meetings.find((x) => x.id === p.meetingId)
      summary = (
        <>
          <div className="title">{meeting?.title}</div>
          <div className="chips" style={{ marginTop: 6 }}>
            {p.companyRefs.map(chip)}
            {p.personRefs.map(chip)}
          </div>
        </>
      )
      form = summary
      break
    }
    case 'update_task': {
      const task = tasks.find((x) => x.id === p.taskId)
      summary = (
        <>
          <div className="title">{p.title ?? task?.title}</div>
          <div className="chips" style={{ marginTop: 6 }}>
            {p.status && task && p.status !== task.status && (
              <span className="chip">
                {t(`task.${task.status}`)} → <strong>{t(`task.${p.status}`)}</strong>
              </span>
            )}
            {p.due && <span className="chip warn">{formatDate(p.due, locale, { weekday: 'short' })}</span>}
            {chip(p.companyRef)}
            {chip(p.personRef)}
          </div>
        </>
      )
      form = (
        <>
          <Field label={t('field.title')}>
            <input className="input" value={p.title ?? task?.title ?? ''} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <div className="row">
            <Field label={t('field.company')} group>
              <RefSelect label={t('field.company')} value={p.companyRef ?? task?.companyId} options={refs.companyOptions} onChange={(v) => set({ companyRef: v })} />
            </Field>
            <Field label={t('field.person')} group>
              <RefSelect label={t('field.person')} value={p.personRef ?? task?.personId} options={refs.personOptions} onChange={(v) => set({ personRef: v })} />
            </Field>
          </div>
          <div className="row">
            <Field label={t('field.status')} group>
              <Select
                label={t('field.status')}
                value={p.status ?? task?.status}
                options={(['planned', 'in_progress', 'done'] as const).map((x) => ({ value: x, label: t(`task.${x}`) }))}
                onChange={(v) => v && set({ status: v as TaskStatus })}
              />
            </Field>
            <Field label={t('field.due')} group>
              <DatePicker label={t('field.due')} value={p.due ?? task?.due ?? ''} onChange={(due) => set({ due })} clearable quick />
            </Field>
          </div>
        </>
      )
      break
    }
  }

  const decision = item.decision
  const decide = (d: Decision) => {
    setEditing(false)
    // Tapping the active choice again undoes it.
    onChange({ decision: decision === d ? 'pending' : d })
  }
  const edit = () => {
    if (decision === 'rejected') onChange({ decision: 'pending' })
    setEditing((e) => !e)
  }

  return (
    <div className={`card proposal ${decision}`}>
      <div className="spread" style={{ marginBottom: 6 }}>
        <span className="row-gap muted small" style={{ fontWeight: 600 }}>
          {icons[p.kind]} {t(`proposal.${p.kind}`)}
        </span>
        <div className="row-gap" style={{ gap: 4 }}>
          {p.kind !== 'delete_task' && p.kind !== 'update_meeting' && (
            <button
              className={`btn ghost icon small${editing ? ' on' : ''}`}
              onClick={edit}
              aria-label={t('common.edit')}
              aria-pressed={editing}
            >
              <Pencil size={16} />
            </button>
          )}
          <button
            className="btn icon small reject"
            onClick={() => decide('rejected')}
            aria-label={t('proposal.reject')}
            aria-pressed={decision === 'rejected'}
          >
            <X size={16} />
          </button>
          <button
            className="btn icon small accept"
            onClick={() => decide('accepted')}
            aria-label={t('proposal.accept')}
            aria-pressed={decision === 'accepted'}
          >
            <Check size={16} />
          </button>
        </div>
      </div>
      {editing ? (
        <div className="form">
          {form}
          <button className="btn primary" onClick={() => decide('accepted')}>
            <Check size={16} /> {t('common.done')}
          </button>
        </div>
      ) : (
        <div onClick={edit} className="proposal-body">{summary}</div>
      )}
      {decision !== 'pending' && !editing && (
        <div className={`decision ${decision}`}>
          {decision === 'accepted' ? <Check size={14} /> : <X size={14} />} {t(`proposal.${decision}`)}
        </div>
      )}
      {decision !== 'rejected' && (p.kind === 'create_company' || p.kind === 'create_person') && !!p.similar?.length && (
        <div className="maybe">
          <span>{t('proposal.maybe')}</span>
          {p.similar.map((id) => (
            <button key={id} className="btn small" onClick={() => onUseExisting(p.ref, id)}>
              {refs.label(id)}
            </button>
          ))}
        </div>
      )}
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
  label,
}: {
  value?: string
  options: Option[]
  onChange: (v: string | undefined) => void
  label: string
}) {
  return <Select label={label} value={value} options={options} onChange={onChange} clearable />
}
