import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, Search, X } from 'lucide-react'

/**
 * Page title row. `fabs` are the page's main actions: inline in the header on desktop,
 * floating bottom-right (thumb reach) on phones.
 */
export function PageHead({
  title,
  back,
  children,
  fabs,
}: {
  title: ReactNode
  back?: boolean
  children?: ReactNode
  fabs?: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <div className="page-head">
      {back && (
        <button className="btn ghost icon back" onClick={() => navigate(-1)} aria-label="Back">
          <ChevronLeft size={22} />
        </button>
      )}
      <h1>{title}</h1>
      {children}
      {fabs && <div className="page-fabs">{fabs}</div>}
    </div>
  )
}

export function Sheet({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`sheet${wide ? ' wide' : ''}`} role="dialog" aria-modal="true">
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="btn ghost icon" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {children}
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  )
}

/** Labelled form row. Use `group` when it holds buttons (chips, pickers) rather than one input. */
export function Field({ label, children, group }: { label: string; children: ReactNode; group?: boolean }) {
  const Tag = group ? 'div' : 'label'
  return (
    <Tag className="field" role={group ? 'group' : undefined} aria-label={group ? label : undefined}>
      <span>{label}</span>
      {children}
    </Tag>
  )
}

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div className="search">
      <Search size={18} />
      <input
        className="input"
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

export function Avatar({ text, square }: { text: string; square?: boolean }) {
  const initials = text
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w))
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
  return <div className={`avatar${square ? ' square' : ''}`}>{initials || '?'}</div>
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

/* ---------- toast ---------- */
let toastMsg: string | null = null
const toastListeners = new Set<() => void>()
let toastTimer: number | undefined

export function toast(msg: string) {
  toastMsg = msg
  toastListeners.forEach((l) => l())
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toastMsg = null
    toastListeners.forEach((l) => l())
  }, 2400)
}

export function Toaster() {
  const msg = useSyncExternalStore(
    (l) => {
      toastListeners.add(l)
      return () => toastListeners.delete(l)
    },
    () => toastMsg,
  )
  return msg ? <div className="toast">{msg}</div> : null
}

export function useDebounced<T>(value: T, ms = 150) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms)
    return () => window.clearTimeout(id)
  }, [value, ms])
  return v
}

/** Error line; the missing-key error links straight to Settings. */
export function ErrorText({ msg, noKeyMsg }: { msg: string; noKeyMsg: string }) {
  if (!msg) return null
  return msg === noKeyMsg ? (
    <Link to="/settings" className="error" style={{ textDecoration: 'underline' }}>
      {msg}
    </Link>
  ) : (
    <span className="error">{msg}</span>
  )
}
