import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Globe, Mail, MapPin, Navigation, Pencil, Phone, Plus } from 'lucide-react'
import { useT } from '../i18n'
import { mapsSearchUrl } from '../lib/format'
import { addressOf } from '../lib/geo'
import { fullName, linkPersonCompany, useDB } from '../store/db'
import { CompanyForm, PersonForm } from '../components/forms'
import { LinkedList, MeetingsSection, TasksSection } from '../components/related'
import { Avatar, PageHead, Section } from '../components/ui'

export function CompanyPage() {
  const t = useT()
  const navigate = useNavigate()
  const { id = '' } = useParams()
  const { companies, people } = useDB()
  const [editing, setEditing] = useState(false)
  const [addingPerson, setAddingPerson] = useState(false)
  const company = companies.find((c) => c.id === id)
  if (!company) return <Navigate to="/companies" replace />

  const address = [company.street, `${company.zip} ${company.city}`.trim()].filter(Boolean).join(', ')
  const members = people.filter((p) => p.companyIds.includes(id))
  const others = people.filter((p) => !p.companyIds.includes(id))

  return (
    <>
      <PageHead title={company.name} back>
        <button className="btn ghost icon" onClick={() => setEditing(true)} aria-label={t('common.edit')}>
          <Pencil size={18} />
        </button>
      </PageHead>

      <div className="quick-actions">
        <a href={`tel:${company.phone}`} className={company.phone ? '' : 'disabled'}>
          <Phone size={20} /> {t('common.call')}
        </a>
        <a href={`mailto:${company.email}`} className={company.email ? '' : 'disabled'}>
          <Mail size={20} /> {t('common.email')}
        </a>
        <a href={mapsSearchUrl(addressOf(company))} target="_blank" rel="noreferrer" className={address ? '' : 'disabled'}>
          <Navigation size={20} /> {t('common.navigate')}
        </a>
      </div>

      <div className="card info section">
        {company.industry && <div className="info-row muted">{company.industry}</div>}
        {address && (
          <div className="info-row">
            <MapPin size={18} /> {address}
          </div>
        )}
        {company.phone && (
          <div className="info-row">
            <Phone size={18} /> <a href={`tel:${company.phone}`}>{company.phone}</a>
          </div>
        )}
        {company.email && (
          <div className="info-row">
            <Mail size={18} /> <a href={`mailto:${company.email}`}>{company.email}</a>
          </div>
        )}
        {company.website && (
          <div className="info-row">
            <Globe size={18} />
            <a href={`https://${company.website.replace(/^https?:\/\//, '')}`} target="_blank" rel="noreferrer">
              {company.website}
            </a>
          </div>
        )}
      </div>

      {company.notes && (
        <Section title={t('common.notes')}>
          <div className="card notes">{company.notes}</div>
        </Section>
      )}

      <Section
        title={t('field.people')}
        action={
          <div className="row-gap">
            {others.length > 0 && (
              <select
                className="select"
                style={{ minHeight: 32, padding: '4px 8px', width: 'auto', maxWidth: 170, fontSize: '0.875rem' }}
                value=""
                onChange={(e) => e.target.value && linkPersonCompany(e.target.value, id, true)}
                aria-label={t('company.linkPerson')}
              >
                <option value="">{t('company.linkPerson')}</option>
                {others.map((p) => (
                  <option key={p.id} value={p.id}>
                    {fullName(p)}
                  </option>
                ))}
              </select>
            )}
            <button className="btn small" onClick={() => setAddingPerson(true)} aria-label={t('person.new')}>
              <Plus size={16} />
            </button>
          </div>
        }
      >
        <LinkedList
          items={members.map((p) => ({
            id: p.id,
            to: `/people/${p.id}`,
            title: fullName(p),
            sub: p.role,
            avatar: <Avatar text={fullName(p)} />,
          }))}
        />
      </Section>

      <TasksSection filter={(x) => x.companyId === id} defaults={{ companyId: id }} />
      <MeetingsSection filter={(m) => m.companyIds.includes(id)} defaults={{ companyIds: [id] }} />

      {editing && (
        <CompanyForm company={company} onClose={() => setEditing(false)} onDeleted={() => navigate('/companies', { replace: true })} />
      )}
      {addingPerson && <PersonForm defaultCompanyId={id} onClose={() => setAddingPerson(false)} />}
    </>
  )
}
