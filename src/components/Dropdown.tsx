import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, Check, ChevronDown, ChevronLeft, ChevronRight, Plus, Search, X } from 'lucide-react'
import { useLocale, useT } from '../i18n'
import { formatDate, localISO, matches, todayISO } from '../lib/format'

/* ---------- shared panel: popover on desktop, bottom sheet on phones ---------- */

const isPhone = () => window.matchMedia('(max-width: 699px)').matches

function Panel({
  anchor,
  title,
  onClose,
  children,
  width,
}: {
  anchor: HTMLElement | null
  title: string
  onClose: () => void
  children: ReactNode
  width?: number
}) {
  const panel = useRef<HTMLDivElement>(null)
  const [phone] = useState(isPhone)
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null)

  useLayoutEffect(() => {
    if (phone || !anchor) return
    const place = () => {
      const r = anchor.getBoundingClientRect()
      const w = Math.max(width ?? 0, r.width)
      const below = window.innerHeight - r.bottom - 12
      const above = r.top - 12
      const h = panel.current?.offsetHeight ?? 320
      const up = below < Math.min(h, 320) && above > below
      const maxHeight = Math.min(380, up ? above : below)
      setPos({
        top: up ? r.top - 6 - Math.min(h, maxHeight) : r.bottom + 6,
        left: Math.min(Math.max(8, r.left), window.innerWidth - w - 8),
        width: w,
        maxHeight,
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [anchor, phone, width])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (!panel.current?.contains(target) && !anchor?.contains(target)) onClose()
    }
    window.addEventListener('keydown', onKey, true)
    if (!phone) document.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.removeEventListener('mousedown', onDown)
    }
  }, [anchor, onClose, phone])

  return createPortal(
    phone ? (
      <div className="picker-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div ref={panel} className="picker-sheet" role="dialog" aria-label={title}>
          <div className="picker-grip" />
          <div className="picker-title">
            <span>{title}</span>
            <button className="btn ghost icon" onClick={onClose} aria-label="Close">
              <X size={20} />
            </button>
          </div>
          {children}
        </div>
      </div>
    ) : (
      <div
        ref={panel}
        className="picker-pop"
        role="dialog"
        aria-label={title}
        style={pos ? { top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight } : { visibility: 'hidden' }}
      >
        {children}
      </div>
    ),
    document.body,
  )
}

/* ---------- Select ---------- */

export interface Option {
  value: string
  label: string
  sub?: string
}

/**
 * Replacement for <select>. Searchable when the list is long.
 * variant "add" renders a "+ label" button and resets after each pick (for adding links).
 */
export function Select({
  value,
  options,
  onChange,
  label,
  placeholder,
  clearable,
  variant = 'field',
  searchable,
}: {
  value?: string
  options: Option[]
  onChange: (value: string | undefined) => void
  label: string
  placeholder?: string
  clearable?: boolean
  variant?: 'field' | 'add' | 'compact'
  searchable?: boolean
}) {
  const t = useT()
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const search = searchable ?? options.length > 8
  const current = options.find((o) => o.value === value)
  const list = useMemo(() => options.filter((o) => matches(q, o.label, o.sub)), [options, q])

  const close = () => {
    setOpen(false)
    setQ('')
    trigger?.focus()
  }
  const pick = (v: string | undefined) => {
    onChange(v)
    close()
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, list.length - 1))
    else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0))
    else if (e.key === 'Enter' && list[active]) pick(list[active].value)
    else return
    e.preventDefault()
  }

  return (
    <>
      <button
        ref={setTrigger}
        type="button"
        className={`select-trigger v-${variant}${open ? ' open' : ''}`}
        onClick={() => {
          setActive(Math.max(0, options.findIndex((o) => o.value === value)))
          setOpen(true)
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
      >
        {variant === 'add' ? (
          <>
            <Plus size={16} /> <span>{placeholder ?? label}</span>
          </>
        ) : (
          <>
            <span className={current ? 'value' : 'placeholder'}>{current?.label ?? placeholder ?? '—'}</span>
            <ChevronDown size={16} className="caret" />
          </>
        )}
      </button>
      {open && (
        <Panel anchor={trigger} title={label} onClose={close} width={260}>
          <div className="picker-body" onKeyDown={onKey}>
            {search && (
              <div className="picker-search">
                <Search size={16} />
                <input
                  autoFocus={!isPhone()}
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value)
                    setActive(0)
                  }}
                  placeholder={t('common.search')}
                />
              </div>
            )}
            <ul className="picker-list" role="listbox" tabIndex={search ? undefined : 0} ref={(el) => { if (el && !search && !isPhone()) el.focus() }}>
              {clearable && value && !q && (
                <li>
                  <button type="button" className="picker-option muted" onClick={() => pick(undefined)}>
                    <X size={16} /> {t('common.clear')}
                  </button>
                </li>
              )}
              {list.length === 0 && <li className="empty">{t('common.none')}</li>}
              {list.map((o, i) => (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={o.value === value}
                    className={`picker-option${o.value === value ? ' selected' : ''}${i === active ? ' active' : ''}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(o.value)}
                  >
                    <span className="grow">
                      <span className="label">{o.label}</span>
                      {o.sub && <span className="sub">{o.sub}</span>}
                    </span>
                    {o.value === value && <Check size={18} />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      )}
    </>
  )
}

/* ---------- DatePicker ---------- */

const parse = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

export function DatePicker({
  value,
  onChange,
  label,
  clearable,
  quick,
}: {
  value: string
  onChange: (iso: string) => void
  label: string
  clearable?: boolean
  /** Show shortcuts for upcoming dates (due dates). */
  quick?: boolean
}) {
  const t = useT()
  const locale = useLocale()
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null)
  const [open, setOpen] = useState(false)
  const today = todayISO()
  const [month, setMonth] = useState(() => {
    const d = parse(value || today)
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const weekdays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: 'narrow' })),
    [locale],
  )
  // Monday-first grid, 6 weeks.
  const first = addDays(month, -((month.getDay() + 6) % 7))
  const days = Array.from({ length: 42 }, (_, i) => addDays(first, i))

  const pick = (iso: string) => {
    onChange(iso)
    setOpen(false)
    trigger?.focus()
  }
  const openPicker = () => {
    const d = parse(value || today)
    setMonth(new Date(d.getFullYear(), d.getMonth(), 1))
    setOpen(true)
  }
  const nextMonday = addDays(parse(today), ((8 - parse(today).getDay()) % 7) || 7)
  const shortcuts = [
    { label: t('date.today'), iso: today },
    { label: t('date.tomorrow'), iso: localISO(addDays(parse(today), 1)) },
    { label: nextMonday.toLocaleDateString(locale, { weekday: 'short', day: 'numeric' }), iso: localISO(nextMonday) },
    { label: t('date.inWeek'), iso: localISO(addDays(parse(today), 7)) },
  ]

  return (
    <>
      <button ref={setTrigger} type="button" className={`select-trigger v-field${open ? ' open' : ''}`} onClick={openPicker} aria-label={label}>
        <Calendar size={16} className="muted" />
        <span className={value ? 'value' : 'placeholder'}>
          {value ? formatDate(value, locale, { weekday: 'short' }) : '—'}
        </span>
        {value === today && <span className="chip primary">{t('date.today')}</span>}
      </button>
      {open && (
        <Panel anchor={trigger} title={label} onClose={() => setOpen(false)} width={320}>
          <div className="calendar">
            {quick && (
              <div className="cal-quick">
                {shortcuts.map((s) => (
                  <button key={s.label} type="button" className={`chip${value === s.iso ? ' primary' : ''}`} onClick={() => pick(s.iso)}>
                    {s.label}
                  </button>
                ))}
              </div>
            )}
            <div className="cal-head">
              <button type="button" className="btn ghost icon" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month">
                <ChevronLeft size={20} />
              </button>
              <span>{month.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}</span>
              <button type="button" className="btn ghost icon" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month">
                <ChevronRight size={20} />
              </button>
            </div>
            <div className="cal-grid">
              {weekdays.map((w, i) => (
                <span key={i} className="cal-wd">
                  {w}
                </span>
              ))}
              {days.map((d) => {
                const iso = localISO(d)
                const cls = [
                  'cal-day',
                  d.getMonth() !== month.getMonth() && 'out',
                  iso === today && 'today',
                  iso === value && 'selected',
                  (d.getDay() === 0 || d.getDay() === 6) && 'weekend',
                ]
                  .filter(Boolean)
                  .join(' ')
                return (
                  <button key={iso} type="button" className={cls} onClick={() => pick(iso)} aria-pressed={iso === value}>
                    {d.getDate()}
                  </button>
                )
              })}
            </div>
            <div className="cal-foot">
              {clearable && value ? (
                <button type="button" className="btn ghost small" onClick={() => pick('')}>
                  {t('common.clear')}
                </button>
              ) : (
                <span />
              )}
              <button type="button" className="btn ghost small" style={{ color: 'var(--primary)' }} onClick={() => pick(today)}>
                {t('date.today')}
              </button>
            </div>
          </div>
        </Panel>
      )}
    </>
  )
}

/* ---------- toggle chips (multi-select) ---------- */

export function ToggleChips({ options, selected, onToggle }: { options: Option[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="chips">
      {options.map((o) => {
        const on = selected.includes(o.value)
        return (
          <button key={o.value} type="button" className={`toggle-chip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => onToggle(o.value)}>
            {on && <Check size={14} strokeWidth={3} />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** Selected item with a remove button. */
export function RemovableChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button type="button" className="chip-remove" onClick={onRemove} aria-label={`${label} ×`}>
      {label} <X size={14} strokeWidth={3} />
    </button>
  )
}
