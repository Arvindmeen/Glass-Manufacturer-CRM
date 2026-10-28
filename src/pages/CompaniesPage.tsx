import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Plus } from 'lucide-react'
import { useT } from '../i18n'
import { matches } from '../lib/format'
import { useDB } from '../store/db'
import { CompanyForm } from '../components/forms'
import { Avatar, PageHead, SearchInput } from '../components/ui'

export function CompaniesPage() {
  const t = useT()
  const navigate = useNavigate()
  const { companies, people } = useDB()
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)

  const list = companies
    .filter((c) => matches(q, c.name, c.city, c.industry, c.zip))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <>
      <PageHead title={t('nav.companies')}>
        <button className="btn primary icon" onClick={() => setCreating(true)} aria-label={t('company.new')}>
          <Plus size={20} />
        </button>
      </PageHead>
      <SearchInput value={q} onChange={setQ} placeholder={t('common.search')} />
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
      {creating && (
        <CompanyForm onClose={() => setCreating(false)} onSaved={(c) => navigate(`/companies/${c.id}`)} />
      )}
    </>
  )
}
