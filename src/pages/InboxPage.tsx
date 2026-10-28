import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, ChevronLeft, FileSearch, Loader2, Pencil, Plus, Send, Trash2 } from 'lucide-react'
import { ERP_NAME } from '../config'
import { useLocale, useT } from '../i18n'
import { formatDate } from '../lib/format'
import { findCompany } from '../lib/interpret'
import { chatJSON, MissingKeyError } from '../lib/openai'
import { getDB, saveEmail, useDB } from '../store/db'
import type { Email, QuoteRequest } from '../types'
import { Field, PageHead } from '../components/ui'

export function InboxPage() {
  const t = useT()
  const { id } = useParams()
  const { emails } = useDB()
  const list = [...emails].sort((a, b) => b.date.localeCompare(a.date))
  const open = emails.find((e) => e.id === id)

  return (
    <div className={`inbox${open ? ' has-open' : ''}`}>
      <div className="inbox-list">
        <PageHead title={t('nav.inbox')} />
        <div className="list">
          {list.map((e) => (
            <EmailRow key={e.id} email={e} active={e.id === id} />
          ))}
        </div>
      </div>
      <div className="inbox-detail">{open && <EmailView key={open.id} email={open} />}</div>
    </div>
  )
}

function EmailRow({ email, active }: { email: Email; active: boolean }) {
  const t = useT()
  const locale = useLocale()
  const sameDay = email.date.slice(0, 10) === new Date().toISOString().slice(0, 10)
  return (
    <Link to={`/inbox/${email.id}`} replace={active} className={`list-item${active ? ' selected' : ''}`}>
      <div className="grow">
        <div className="spread">
          <span className="title" style={{ fontWeight: email.read ? 500 : 700 }}>
            {email.fromName}
          </span>
          <span className="muted small" style={{ flex: 'none' }}>
            {sameDay
              ? new Date(email.date).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
              : formatDate(email.date, locale, { year: undefined })}
          </span>
        </div>
        <div className="sub" style={{ color: email.read ? undefined : 'var(--text)' }}>{email.subject}</div>
        {email.isQuote && (
          <div className="chips" style={{ marginTop: 4 }}>
            <span className={`chip ${email.transferredAt ? 'ok' : 'warn'}`}>
              {email.transferredAt ? t('inbox.transferred', { erp: ERP_NAME }) : t('inbox.quote')}
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}

const emptyItem = { product: '', quantity: 1, dimensions: '' }

async function extractQuote(email: Email): Promise<QuoteRequest> {
  const r = await chatJSON<Partial<QuoteRequest>>(
    `Extract a quote request for a glass manufacturer from the email.
Return JSON: {"customer": company name, "contact": person name, "items": [{"product": product incl. glass type, thickness, finish and extras, "quantity": number, "dimensions": "W x H mm" or ""}], "notes": delivery dates, deadlines and other requirements}.
Keep the email's language. Use "" when unknown.`,
    `From: ${email.fromName} <${email.fromEmail}>\nSubject: ${email.subject}\n\n${email.body}`,
  )
  return {
    customer: r.customer ?? '',
    contact: r.contact ?? email.fromName,
    notes: r.notes ?? '',
    items: (r.items ?? []).map((i) => ({
      product: String(i.product ?? ''),
      quantity: Number(i.quantity) || 1,
      dimensions: String(i.dimensions ?? ''),
    })),
  }
}

function matchCompany(email: Email, customer: string) {
  const db = getDB()
  const domain = email.fromEmail.split('@')[1]?.toLowerCase()
  return (
    (customer && findCompany(db, customer)) ||
    db.companies.find((c) => domain && (c.email.toLowerCase().endsWith(`@${domain}`) || c.website.toLowerCase().includes(domain)))
  )
}

function EmailView({ email }: { email: Email }) {
  const t = useT()
  const locale = useLocale()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<QuoteRequest | null>(null)
  const [busy, setBusy] = useState<'extract' | 'transfer' | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!email.read) saveEmail({ ...email, read: true })
  }, [email])

  const extract = async () => {
    setBusy('extract')
    setError('')
    try {
      setDraft(await extractQuote(email))
    } catch (e) {
      setError(e instanceof MissingKeyError ? t('voice.noKey') : t('voice.error', { msg: (e as Error).message }))
    } finally {
      setBusy(null)
    }
  }

  const transfer = () => {
    setBusy('transfer')
    window.setTimeout(() => {
      saveEmail({ ...getDB().emails.find((e) => e.id === email.id)!, transferredAt: new Date().toISOString() })
      setBusy(null)
    }, 1200)
  }

  const quote = email.quote
  const company = matchCompany(email, (draft ?? quote)?.customer ?? '')

  return (
    <>
      <div className="page-head">
        <button className="btn ghost icon back inbox-back" onClick={() => navigate('/inbox')} aria-label={t('common.back')}>
          <ChevronLeft size={22} />
        </button>
        <h1 style={{ fontSize: '1.15rem' }}>{email.subject}</h1>
      </div>
      <div className="card" style={{ padding: 14 }}>
        <div className="spread small">
          <span>
            <strong>{email.fromName}</strong> <span className="muted">{email.fromEmail}</span>
          </span>
          <span className="muted">{formatDate(email.date, locale)}</span>
        </div>
        <div style={{ whiteSpace: 'pre-wrap', marginTop: 12 }}>{email.body}</div>
      </div>

      {email.isQuote && (
        <div className="section">
          {draft ? (
            <QuoteEditor
              draft={draft}
              onChange={setDraft}
              companyName={company?.name}
              onConfirm={() => {
                saveEmail({ ...email, quote: draft })
                setDraft(null)
              }}
              onCancel={() => setDraft(null)}
            />
          ) : quote ? (
            <div className="card" style={{ padding: 14 }}>
              <div className="spread" style={{ marginBottom: 8 }}>
                <div>
                  {company ? (
                    <Link to={`/companies/${company.id}`} style={{ fontWeight: 600, color: 'var(--primary)' }}>
                      {company.name}
                    </Link>
                  ) : (
                    <div style={{ fontWeight: 600 }}>{quote.customer}</div>
                  )}
                  <div className="muted small">{quote.contact}</div>
                </div>
                {!email.transferredAt && (
                  <button className="btn ghost icon" onClick={() => setDraft(quote)} aria-label={t('common.edit')}>
                    <Pencil size={18} />
                  </button>
                )}
              </div>
              <table className="quote-table">
                <thead>
                  <tr>
                    <th>{t('inbox.qty')}</th>
                    <th>{t('inbox.product')}</th>
                    <th>{t('inbox.dimensions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.items.map((i, n) => (
                    <tr key={n}>
                      <td>{i.quantity}</td>
                      <td>{i.product}</td>
                      <td>{i.dimensions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {quote.notes && <p className="small" style={{ marginBottom: 0 }}>{quote.notes}</p>}
              <div style={{ marginTop: 14 }}>
                {email.transferredAt ? (
                  <div className="row-gap" style={{ color: 'var(--ok)', fontWeight: 600 }}>
                    <CheckCircle2 size={20} /> {t('inbox.transferred', { erp: ERP_NAME })} ·{' '}
                    {new Date(email.transferredAt).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })}
                  </div>
                ) : (
                  <button className="btn primary lg block" onClick={transfer} disabled={busy === 'transfer'}>
                    {busy === 'transfer' ? <Loader2 size={18} className="spin" /> : <Send size={18} />}{' '}
                    {t('inbox.transfer', { erp: ERP_NAME })}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <button className="btn primary lg block" onClick={() => void extract()} disabled={busy === 'extract'}>
              {busy === 'extract' ? <Loader2 size={18} className="spin" /> : <FileSearch size={18} />} {t('inbox.extract')}
            </button>
          )}
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </>
  )
}

function QuoteEditor({
  draft,
  onChange,
  companyName,
  onConfirm,
  onCancel,
}: {
  draft: QuoteRequest
  onChange: (q: QuoteRequest) => void
  companyName?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const t = useT()
  const setItem = (n: number, patch: Partial<QuoteRequest['items'][number]>) =>
    onChange({ ...draft, items: draft.items.map((i, k) => (k === n ? { ...i, ...patch } : i)) })

  return (
    <div className="card form" style={{ padding: 14 }}>
      <div className="row">
        <Field label={t('inbox.customer')}>
          <input className="input" value={draft.customer} onChange={(e) => onChange({ ...draft, customer: e.target.value })} />
        </Field>
        <Field label={t('inbox.contact')}>
          <input className="input" value={draft.contact} onChange={(e) => onChange({ ...draft, contact: e.target.value })} />
        </Field>
      </div>
      {companyName && (
        <div>
          <span className="chip primary">{companyName}</span>
        </div>
      )}
      {draft.items.map((i, n) => (
        <div key={n} className="quote-item">
          <input
            className="input qty"
            type="number"
            min={1}
            inputMode="numeric"
            value={i.quantity}
            onChange={(e) => setItem(n, { quantity: Number(e.target.value) })}
            aria-label={t('inbox.qty')}
          />
          <input className="input" value={i.product} onChange={(e) => setItem(n, { product: e.target.value })} placeholder={t('inbox.product')} />
          <input className="input dims" value={i.dimensions} onChange={(e) => setItem(n, { dimensions: e.target.value })} placeholder={t('inbox.dimensions')} />
          <button
            className="btn ghost icon"
            onClick={() => onChange({ ...draft, items: draft.items.filter((_, k) => k !== n) })}
            aria-label={t('common.delete')}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <button className="btn small" style={{ justifySelf: 'start' }} onClick={() => onChange({ ...draft, items: [...draft.items, { ...emptyItem }] })}>
        <Plus size={16} /> {t('inbox.addItem')}
      </button>
      <Field label={t('common.notes')}>
        <textarea className="textarea" rows={2} value={draft.notes} onChange={(e) => onChange({ ...draft, notes: e.target.value })} />
      </Field>
      <div className="row-gap" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <button className="btn primary" onClick={onConfirm} disabled={draft.items.length === 0}>
          {t('inbox.confirm')}
        </button>
      </div>
    </div>
  )
}
