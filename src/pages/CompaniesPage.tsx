import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Check, ChevronRight, Loader2, Navigation, Plus, Route } from 'lucide-react'
import { useT } from '../i18n'
import { matches } from '../lib/format'
import { addressOf, embedArea, embedPlace, embedRoute, locate } from '../lib/geo'
import { currentPosition, googleMapsRoute, haversine, planRoute, type Point } from '../lib/route'
import { useDB } from '../store/db'
import type { Company } from '../types'
import { CompanyForm } from '../components/forms'
import { Avatar, PageHead, SearchInput, useSearchQuery } from '../components/ui'
import { flash, useRecent } from '../lib/recent'

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
  const [q, setQ] = useSearchQuery()
  const recent = useRecent()
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [route, setRoute] = useState<PlannedRoute | null>(null)
  const [planning, setPlanning] = useState(false)
  const [focus, setFocus] = useState<Company | null>(null)

  const list = companies
    .filter((c) => matches(q, c.name, c.city, c.industry, c.zip))
    .sort((a, b) => a.name.localeCompare(b.name))

  const toggle = (c: Company) => {
    setRoute(null)
    const on = selected.includes(c.id)
    setSelected((s) => (on ? s.filter((x) => x !== c.id) : [...s, c.id]))
    setFocus(on ? null : c)
  }

  const plan = async (ids = selected) => {
    setPlanning(true)
    const chosen = ids.map((id) => companies.find((c) => c.id === id)).filter((c): c is Company => !!c)
    const stops = chosen.filter((c) => locate(c))
    const unlocated = chosen.filter((c) => !locate(c))
    const points = stops.map((c) => locate(c)!)
    const here = await currentPosition()
    const start = here && points.some((p) => haversine(here, p) < MAX_START_KM) ? here : undefined
    const r = planRoute(points, start)
    // Stops without coordinates cannot be ordered; they go last.
    setRoute({ stops: [...r.order.map((i) => stops[i]), ...unlocated], km: r.km, start })
    setPlanning(false)
  }

  // The assistant opens the map with ?route=c1,c6: select those stops and plan right away.
  const routeParam = params.get('route')
  useEffect(() => {
    if (!routeParam) return
    const ids = routeParam.split(',').filter((id) => companies.some((c) => c.id === id))
    setParams((p) => { const n = new URLSearchParams(p); n.delete('route'); return n }, { replace: true })
    if (ids.length < 2) return
    setSelected(ids)
    void plan(ids)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeParam])

  const mapSrc = route
    ? embedRoute(route.stops.map(addressOf), route.start)
    : focus
      ? embedPlace(focus)
      : embedArea(list.map(locate).filter((p): p is Point => !!p))

  return (
    <>
      <PageHead
        title={t('nav.companies')}
        fabs={
          view === 'list' && (
            <button className="btn primary icon fab-main" onClick={() => setCreating(true)} aria-label={t('company.new')}>
              <Plus size={22} />
            </button>
          )
        }
      >
        <div className="segmented" style={{ width: 'auto' }}>
          <button className={view === 'list' ? 'active' : ''} onClick={() => setParams((p) => { const n = new URLSearchParams(p); n.delete('view'); return n }, { replace: true })}>
            {t('company.list')}
          </button>
          <button className={view === 'map' ? 'active' : ''} onClick={() => setParams((p) => { const n = new URLSearchParams(p); n.set('view', 'map'); return n }, { replace: true })}>
            {t('company.map')}
          </button>
        </div>
      </PageHead>
      <SearchInput value={q} onChange={setQ} placeholder={t('common.search')} />

      {view === 'list' ? (
        <div className="list">
          {list.length === 0 && <div className="empty">{t('common.none')}</div>}
          {list.map((c) => {
            const count = people.filter((p) => p.companyIds.includes(c.id)).length
            return (
              <button key={c.id} className={`list-item${flash(recent, c.id)}`} onClick={() => navigate(`/companies/${c.id}`)}>
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
            <iframe key={mapSrc} title={t('company.map')} src={mapSrc} className="map" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" />
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
                {list.map((c) => {
                  const on = selected.includes(c.id)
                  return (
                    <button key={c.id} className={`list-item${on ? ' selected' : ''}`} onClick={() => toggle(c)}>
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
