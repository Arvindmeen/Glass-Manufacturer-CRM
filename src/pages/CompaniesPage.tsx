import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Check, ChevronRight, Loader2, Navigation, Plus, Route } from 'lucide-react'
import { useT } from '../i18n'
import { matches } from '../lib/format'
import { addressOf, locate } from '../lib/geo'
import { currentPosition, googleMapsRoute, haversine, planRoute, type Point } from '../lib/route'
import { useDB } from '../store/db'
import type { Company } from '../types'
import { CompanyForm } from '../components/forms'
import { CompanyMap } from '../components/CompanyMap'
import { Avatar, PageHead, SearchInput } from '../components/ui'

/** Ignore the phone's position when it is far from all stops (e.g. testing from abroad). */
const MAX_START_KM = 150

interface PlannedRoute {
  stops: Company[]
  km: number
  start?: Point
}

export function CompaniesPage() {
  const t = useT()
  const navigate = useNavigate()
  const { companies, people } = useDB()
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'map' ? 'map' : 'list'
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [route, setRoute] = useState<PlannedRoute | null>(null)
  const [planning, setPlanning] = useState(false)

  const list = companies
    .filter((c) => matches(q, c.name, c.city, c.industry, c.zip))
    .sort((a, b) => a.name.localeCompare(b.name))

  const toggle = (id: string) => {
    setRoute(null)
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  const plan = async () => {
    setPlanning(true)
    const stops = selected.map((id) => companies.find((c) => c.id === id)!).filter((c) => locate(c))
    const points = stops.map((c) => locate(c)!)
    const here = await currentPosition()
    const start = here && points.some((p) => haversine(here, p) < MAX_START_KM) ? here : undefined
    const r = planRoute(points, start)
    setRoute({ stops: r.order.map((i) => stops[i]), km: r.km, start })
    setPlanning(false)
  }

  const located = list.filter((c) => locate(c))
  const orderOf = (id: string) => {
    const i = route?.stops.findIndex((s) => s.id === id) ?? -1
    return i >= 0 ? i : undefined
  }

  return (
    <>
      <PageHead title={t('nav.companies')}>
        <div className="segmented" style={{ width: 'auto' }}>
          <button className={view === 'list' ? 'active' : ''} onClick={() => setParams({}, { replace: true })}>
            {t('company.list')}
          </button>
          <button className={view === 'map' ? 'active' : ''} onClick={() => setParams({ view: 'map' }, { replace: true })}>
            {t('company.map')}
          </button>
        </div>
        <button className="btn primary icon" onClick={() => setCreating(true)} aria-label={t('company.new')}>
          <Plus size={20} />
        </button>
      </PageHead>
      <SearchInput value={q} onChange={setQ} placeholder={t('common.search')} />

      {view === 'list' ? (
        <div className="list">
          {list.length === 0 && <div className="empty">{t('common.none')}</div>}
          {list.map((c) => {
            const count = people.filter((p) => p.companyIds.includes(c.id)).length
            return (
              <button key={c.id} className="list-item" onClick={() => navigate(`/companies/${c.id}`)}>
                <Avatar text={c.name} square />
                <div className="grow">
                  <div className="title">{c.name}</div>
                  <div className="sub">{[c.city, c.industry].filter(Boolean).join(' · ')}</div>
                </div>
                {count > 0 && <span className="chip">{count}</span>}
                <ChevronRight size={18} className="muted" />
              </button>
            )
          })}
        </div>
      ) : (
        <div className="map-layout">
          <div className="card map-card">
            <CompanyMap
              start={route?.start}
              onToggle={toggle}
              pins={located.map((c) => ({
                id: c.id,
                label: c.name,
                point: locate(c)!,
                selected: selected.includes(c.id),
                order: orderOf(c.id),
              }))}
            />
          </div>

          {route ? (
            <div className="stack">
              <div className="list">
                {route.stops.map((c, i) => (
                  <div key={c.id} className="list-item" onClick={() => navigate(`/companies/${c.id}`)}>
                    <div className="avatar" style={{ background: 'var(--accent)', color: '#fff' }}>{i + 1}</div>
                    <div className="grow">
                      <div className="title">{c.name}</div>
                      <div className="sub">{[c.street, c.city].filter(Boolean).join(', ')}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="sticky-action">
                <span className="muted small">≈ {Math.round(route.km)} km</span>
                <button className="btn" onClick={() => setRoute(null)}>
                  {t('common.edit')}
                </button>
                <a
                  className="btn primary lg grow"
                  href={googleMapsRoute(route.stops.map(addressOf), !!route.start)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Navigation size={18} /> {t('company.openRoute')}
                </a>
              </div>
            </div>
          ) : (
            <div className="stack">
              <div className="list">
                {located.map((c) => {
                  const on = selected.includes(c.id)
                  return (
                    <button key={c.id} className={`list-item${on ? ' selected' : ''}`} onClick={() => toggle(c.id)}>
                      <span className={`check${on ? ' on' : ''}`}>{on && <Check size={14} />}</span>
                      <div className="grow">
                        <div className="title">{c.name}</div>
                        <div className="sub">{c.city}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
              {selected.length > 0 && (
                <div className="sticky-action">
                  <button className="btn ghost" onClick={() => setSelected([])}>
                    {t('company.selected', { n: selected.length })} ×
                  </button>
                  <button className="btn primary lg grow" disabled={selected.length < 2 || planning} onClick={() => void plan()}>
                    {planning ? <Loader2 size={18} className="spin" /> : <Route size={18} />} {t('company.planRoute')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {creating && (
        <CompanyForm onClose={() => setCreating(false)} onSaved={(c) => navigate(`/companies/${c.id}`)} />
      )}
    </>
  )
}
