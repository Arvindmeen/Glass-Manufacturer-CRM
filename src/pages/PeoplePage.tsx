import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Phone, Plus } from 'lucide-react'
import { useT } from '../i18n'
import { matches } from '../lib/format'
import { fullName, useDB } from '../store/db'
import { PersonForm } from '../components/forms'
import { Avatar, PageHead, SearchInput, useSearchQuery } from '../components/ui'
import { flash, useRecent } from '../lib/recent'

export function PeoplePage() {
  const t = useT()
  const navigate = useNavigate()
  const { people, companies } = useDB()
  const [q, setQ] = useSearchQuery()
  const recent = useRecent()
  const [creating, setCreating] = useState(false)

  const companyNames = (ids: string[]) =>
    ids.map((id) => companies.find((c) => c.id === id)?.name).filter(Boolean).join(', ')

  const list = people
    .filter((p) => matches(q, fullName(p), p.role, companyNames(p.companyIds)))
    .sort((a, b) => a.lastName.localeCompare(b.lastName))

  return (
    <>
      <PageHead
        title={t('nav.people')}
        fabs={
          <button className="btn primary icon fab-main" onClick={() => setCreating(true)} aria-label={t('person.new')}>
            <Plus size={22} />
          </button>
        }
      />
      <SearchInput value={q} onChange={setQ} placeholder={t('common.search')} />
      <div className="list">
        {list.length === 0 && <div className="empty">{t('common.none')}</div>}
        {list.map((p) => (
          <div
            key={p.id}
            className={`list-item${flash(recent, p.id)}`}
            role="link"
            tabIndex={0}
            onClick={() => navigate(`/people/${p.id}`)}
            onKeyDown={(e) => e.key === 'Enter' && navigate(`/people/${p.id}`)}
          >
            <Avatar text={fullName(p)} />
            <div className="grow">
              <div className="title">{fullName(p)}</div>
              <div className="sub">{[p.role, companyNames(p.companyIds)].filter(Boolean).join(' · ')}</div>
            </div>
            {p.phone && (
              <a
                className="btn ghost icon"
                href={`tel:${p.phone}`}
                onClick={(e) => e.stopPropagation()}
                aria-label={t('common.call')}
              >
                <Phone size={18} />
              </a>
            )}
            <ChevronRight size={18} className="muted" />
          </div>
        ))}
      </div>
      {creating && <PersonForm onClose={() => setCreating(false)} onSaved={(p) => navigate(`/people/${p.id}`)} />}
    </>
  )
}
