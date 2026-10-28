import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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

const SHEET_MS = 240
export const isPhone = () => window.matchMedia('(max-width: 699px)').matches

/**
 * Animated close for anything rendered in a <Sheet>: call `close()` instead of `onClose()`,
 * pass `closing` to the Sheet; `onClose` runs once the exit animation has finished.
 */
export function useClosing(onClose: () => void) {
  const [closing, setClosing] = useState(false)
  const done = useRef(onClose)
  useEffect(() => {
    done.current = onClose
  })
  const close = useCallback(() => {
    setClosing((was) => {
      if (!was)
        window.setTimeout(() => {
          done.current()
          setClosing(false) // components that stay mounted (pickers) can open again
        }, SHEET_MS)
      return true
    })
  }, [])
  return [closing, close] as const
}

/**
 * Modal sheet. On phones it is a bottom sheet: it opens at its natural size, the grip
 * (or header) can be dragged up to full screen, back down, or further down to close.
 */
export function Sheet({
  title,
  onClose,
  closing,
  children,
  footer,
  wide,
  height,
  bodyRef,
}: {
  title: ReactNode
  onClose: () => void
  closing?: boolean
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
  /** Resting height on phones (CSS length); default is the content height. */
  height?: string
  bodyRef?: React.Ref<HTMLDivElement>
}) {
  const [phone] = useState(isPhone)
  const [full, setFull] = useState(false)
  const el = useRef<HTMLDivElement>(null)
  const base = useRef(0)
  const drag = useRef<{ y: number; h: number; t: number; lastY: number; lastT: number; onGrip: boolean } | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  /** How tall the sheet would be with all content visible. */
  const naturalHeight = () => {
    const s = el.current
    if (!s) return 0
    const part = (sel: string) => (s.querySelector(sel) as HTMLElement | null)
    return (part('.sheet-top')?.offsetHeight ?? 0) + (part('.sheet-body')?.scrollHeight ?? 0) + (part('.sheet-foot')?.offsetHeight ?? 0)
  }
  /** Forms grow only as far as their content; sheets with a fixed height (chat) can fill the screen. */
  const maxHeight = () => (height ? window.innerHeight : Math.min(window.innerHeight, naturalHeight()))

  const restingHeight = () => {
    if (!base.current && el.current) base.current = el.current.offsetHeight
    return base.current
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (!phone || !el.current || (e.target as HTMLElement).closest('button, input, a')) return
    restingHeight()
    const now = performance.now()
    drag.current = {
      y: e.clientY,
      h: el.current.offsetHeight,
      t: now,
      lastY: e.clientY,
      lastT: now,
      // Pointer capture retargets later events, so remember where the press started.
      onGrip: !!(e.target as HTMLElement).closest('.sheet-grip'),
    }
    el.current.style.transition = 'none'
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    const s = el.current
    if (!d || !s) return
    const target = d.h - (e.clientY - d.y)
    if (target >= base.current) {
      s.style.height = `${Math.min(target, Math.max(maxHeight(), base.current))}px`
      s.style.transform = ''
    } else {
      s.style.height = `${base.current}px`
      s.style.transform = `translateY(${base.current - target}px)`
    }
    d.lastY = e.clientY
    d.lastT = performance.now()
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current
    const s = el.current
    drag.current = null
    if (!d || !s) return
    s.style.transition = ''
    // A tap (no real movement) on the grip toggles full screen.
    if (Math.abs(e.clientY - d.y) < 6) {
      s.style.transform = ''
      if (d.onGrip) toggleFull()
      return
    }
    const target = d.h - (e.clientY - d.y)
    const velocity = (e.clientY - d.lastY) / Math.max(1, performance.now() - d.lastT) // px/ms, + = down
    // From full screen a drag-down returns to the resting size; closing needs a drag from rest (or a fling).
    const fromFull = d.h > base.current + 10
    const shouldClose = fromFull
      ? velocity > 1.2 && target < base.current * 0.5
      : target < base.current * 0.75 || (velocity > 0.6 && target < base.current)
    if (shouldClose) {
      onClose() // the closing class slides it out from where it is
      return
    }
    s.style.transform = ''
    const room = maxHeight() - base.current
    const goFull = room > 8 && (velocity < -0.5 || target > base.current + room * 0.35)
    setFull(goFull)
    s.style.height = goFull ? '' : `${base.current}px`
  }

  const toggleFull = () => {
    restingHeight()
    if (!full && maxHeight() - base.current <= 8) return // already shows everything
    if (el.current) el.current.style.height = full ? `${base.current}px` : ''
    setFull((f) => !f)
  }

  const dragProps = phone ? { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp } : {}

  return (
    <div className={`sheet-backdrop${closing ? ' closing' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={el}
        className={`sheet${wide ? ' wide' : ''}${full ? ' full' : ''}${closing ? ' closing' : ''}`}
        role="dialog"
        aria-modal="true"
        style={phone && height && !full ? { height } : undefined}
      >
        <div className="sheet-top" {...dragProps}>
          {phone && (
            <div
              className="sheet-grip"
              role="button"
              tabIndex={0}
              aria-label={full ? 'Collapse' : 'Expand'}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleFull()}
            />
          )}
          <div className="sheet-head">
            <h2>{title}</h2>
            <button className="btn ghost icon" onClick={onClose} aria-label="Close">
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="sheet-body" ref={bodyRef}>
          {children}
        </div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  )
}

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

/** List search kept in the URL (?q=), so the assistant can open a list with a search applied. */
export function useSearchQuery() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const setQ = (v: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (v) next.set('q', v)
        else next.delete('q')
        return next
      },
      { replace: true },
    )
  return [q, setQ] as const
}
