import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Mail, MessageSquare, Pencil, Phone } from 'lucide-react'
import { useT } from '../i18n'
import { fullName, linkPersonCompany, useDB } from '../store/db'
import { PersonForm } from '../components/forms'
import { Select } from '../components/Dropdown'
import { companyOptions } from '../components/options'
import { LinkedList, MeetingsSection, TasksSection } from '../components/related'
import { Avatar, PageHead, Section } from '../components/ui'

export function PersonPage() {
  const t = useT()
  const navigate = useNavigate()
  const { id = '' } = useParams()
  const { people, companies } = useDB()
  const [editing, setEditing] = useState(false)
  const person = people.find((p) => p.id === id)
  if (!person) return <Navigate to="/people" replace />

  const linked = companies.filter((c) => person.companyIds.includes(c.id))
  const others = companies.filter((c) => !person.companyIds.includes(c.id))
  const name = fullName(person)

  return (
    <>
      <PageHead title={name} back>
        <button className="btn ghost icon" onClick={() => setEditing(true)} aria-label={t('common.edit')}>
          <Pencil size={18} />
        </button>
      </PageHead>
      {person.role && <p className="muted" style={{ margin: '-8px 0 12px' }}>{person.role}</p>}

      <div className="quick-actions">
        <a href={`tel:${person.phone}`} className={person.phone ? '' : 'disabled'}>
          <Phone size={20} /> {t('common.call')}
        </a>
        <a href={`sms:${person.phone}`} className={person.phone ? '' : 'disabled'}>
          <MessageSquare size={20} /> SMS
        </a>
        <a href={`mailto:${person.email}`} className={person.email ? '' : 'disabled'}>
          <Mail size={20} /> {t('common.email')}
        </a>
      </div>

      <div className="card info section">
        {person.phone && (
          <div className="info-row">
            <Phone size={18} /> <a href={`tel:${person.phone}`}>{person.phone}</a>
          </div>
        )}
        {person.email && (
          <div className="info-row">
            <Mail size={18} /> <a href={`mailto:${person.email}`}>{person.email}</a>
          </div>
        )}
      </div>

      {person.notes && (
        <Section title={t('common.notes')}>
          <div className="card notes">{person.notes}</div>
        </Section>
      )}

      <Section
        title={t('field.companies')}
        action={
          others.length > 0 && (
            <Select
              variant="add"
              label={t('person.linkCompany')}
              options={companyOptions(others)}
              onChange={(v) => v && linkPersonCompany(id, v, true)}
            />
          )
        }
      >
        <LinkedList
          items={linked.map((c) => ({
            id: c.id,
            to: `/companies/${c.id}`,
            title: c.name,
            sub: c.city,
            avatar: <Avatar text={c.name} square />,
          }))}
        />
      </Section>

      <TasksSection
        filter={(x) => x.personId === id}
        defaults={{ personId: id, companyId: person.companyIds.length === 1 ? person.companyIds[0] : undefined }}
      />
      <MeetingsSection
        filter={(m) => m.personIds.includes(id)}
        defaults={{ personIds: [id], companyIds: person.companyIds.slice(0, 1) }}
      />

      {editing && (
        <PersonForm person={person} onClose={() => setEditing(false)} onDeleted={() => navigate('/people', { replace: true })} />
      )}
    </>
  )
}
