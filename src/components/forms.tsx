import { useState } from 'react'
import { useT } from '../i18n'
import {
  blankCompany,
  blankPerson,
  blankTask,
  deleteCompany,
  deletePerson,
  deleteTask,
  fullName,
  saveCompany,
  savePerson,
  saveTask,
  useDB,
} from '../store/db'
import type { Company, Person, Task, TaskStatus } from '../types'
import { Field, Sheet } from './ui'

function useDraft<T>(initial: T) {
  const [draft, setDraft] = useState(initial)
  const set = <K extends keyof T>(k: K) => (e: { target: { value: string } }) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }))
  return [draft, setDraft, set] as const
}

function Footer({ onDelete, onCancel, canSave }: { onDelete?: () => void; onCancel: () => void; canSave: boolean }) {
  const t = useT()
  return (
    <>
      {onDelete && (
        <button className="btn danger ghost" type="button" onClick={onDelete}>
          {t('common.delete')}
        </button>
      )}
      <span className="grow" />
      <button className="btn" type="button" onClick={onCancel}>
        {t('common.cancel')}
      </button>
      <button className="btn primary" type="submit" form="entity-form" disabled={!canSave}>
        {t('common.save')}
      </button>
    </>
  )
}

export function CompanyForm({
  company,
  onClose,
  onSaved,
  onDeleted,
}: {
  company?: Company
  onClose: () => void
  onSaved?: (c: Company) => void
  onDeleted?: () => void
}) {
  const t = useT()
  const [d, , set] = useDraft(company ?? blankCompany())
  const isNew = !company
  return (
    <Sheet
      title={isNew ? t('company.new') : d.name}
      onClose={onClose}
      footer={
        <Footer
          canSave={!!d.name.trim()}
          onCancel={onClose}
          onDelete={
            isNew
              ? undefined
              : () => {
                  if (confirm(t('common.confirmDelete'))) {
                    deleteCompany(d.id)
                    onDeleted?.()
                  }
                }
          }
        />
      }
    >
      <form
        id="entity-form"
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          onSaved?.(saveCompany({ ...d, name: d.name.trim() }))
          onClose()
        }}
      >
        <Field label={t('field.name')}>
          <input className="input" value={d.name} onChange={set('name')} autoFocus={isNew} required />
        </Field>
        <Field label={t('field.industry')}>
          <input className="input" value={d.industry} onChange={set('industry')} />
        </Field>
        <Field label={t('field.street')}>
          <input className="input" value={d.street} onChange={set('street')} autoComplete="street-address" />
        </Field>
        <div className="row zip">
          <Field label={t('field.zip')}>
            <input className="input" value={d.zip} onChange={set('zip')} inputMode="numeric" />
          </Field>
          <Field label={t('field.city')}>
            <input className="input" value={d.city} onChange={set('city')} />
          </Field>
        </div>
        <div className="row">
          <Field label={t('field.phone')}>
            <input className="input" value={d.phone} onChange={set('phone')} type="tel" />
          </Field>
          <Field label={t('field.email')}>
            <input className="input" value={d.email} onChange={set('email')} type="email" />
          </Field>
        </div>
        <Field label={t('field.website')}>
          <input className="input" value={d.website} onChange={set('website')} />
        </Field>
        <Field label={t('common.notes')}>
          <textarea className="textarea" value={d.notes} onChange={set('notes')} />
        </Field>
      </form>
    </Sheet>
  )
}

export function PersonForm({
  person,
  defaultCompanyId,
  onClose,
  onSaved,
  onDeleted,
}: {
  person?: Person
  defaultCompanyId?: string
  onClose: () => void
  onSaved?: (p: Person) => void
  onDeleted?: () => void
}) {
  const t = useT()
  const { companies } = useDB()
  const [d, setD, set] = useDraft(person ?? blankPerson({ companyIds: defaultCompanyId ? [defaultCompanyId] : [] }))
  const isNew = !person
  const toggleCompany = (id: string) =>
    setD((x) => ({
      ...x,
      companyIds: x.companyIds.includes(id) ? x.companyIds.filter((c) => c !== id) : [...x.companyIds, id],
    }))

  return (
    <Sheet
      title={isNew ? t('person.new') : fullName(d)}
      onClose={onClose}
      footer={
        <Footer
          canSave={!!(d.firstName.trim() || d.lastName.trim())}
          onCancel={onClose}
          onDelete={
            isNew
              ? undefined
              : () => {
                  if (confirm(t('common.confirmDelete'))) {
                    deletePerson(d.id)
                    onDeleted?.()
                  }
                }
          }
        />
      }
    >
      <form
        id="entity-form"
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          onSaved?.(savePerson(d))
          onClose()
        }}
      >
        <div className="row">
          <Field label={t('field.firstName')}>
            <input className="input" value={d.firstName} onChange={set('firstName')} autoFocus={isNew} />
          </Field>
          <Field label={t('field.lastName')}>
            <input className="input" value={d.lastName} onChange={set('lastName')} />
          </Field>
        </div>
        <Field label={t('field.role')}>
          <input className="input" value={d.role} onChange={set('role')} />
        </Field>
        <div className="row">
          <Field label={t('field.phone')}>
            <input className="input" value={d.phone} onChange={set('phone')} type="tel" />
          </Field>
          <Field label={t('field.email')}>
            <input className="input" value={d.email} onChange={set('email')} type="email" />
          </Field>
        </div>
        <Field label={t('field.companies')}>
          <div className="chips">
            {d.companyIds.map((id) => {
              const c = companies.find((x) => x.id === id)
              return (
                <button key={id} type="button" className="chip primary" onClick={() => toggleCompany(id)}>
                  {c?.name ?? '?'} ×
                </button>
              )
            })}
          </div>
          <select
            className="select"
            value=""
            onChange={(e) => e.target.value && toggleCompany(e.target.value)}
          >
            <option value="">+ {t('person.linkCompany')}</option>
            {companies
              .filter((c) => !d.companyIds.includes(c.id))
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label={t('common.notes')}>
          <textarea className="textarea" value={d.notes} onChange={set('notes')} />
        </Field>
      </form>
    </Sheet>
  )
}

export function TaskForm({
  task,
  defaults,
  onClose,
}: {
  task?: Task
  defaults?: Partial<Task>
  onClose: () => void
}) {
  const t = useT()
  const { companies, people } = useDB()
  const [d, setD, set] = useDraft(task ?? blankTask(defaults))
  const isNew = !task
  const peopleOptions = d.companyId ? people.filter((p) => p.companyIds.includes(d.companyId!)) : people

  return (
    <Sheet
      title={isNew ? t('task.new') : t('task.title')}
      onClose={onClose}
      footer={
        <Footer
          canSave={!!d.title.trim()}
          onCancel={onClose}
          onDelete={
            isNew
              ? undefined
              : () => {
                  deleteTask(d.id)
                  onClose()
                }
          }
        />
      }
    >
      <form
        id="entity-form"
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          saveTask({ ...d, title: d.title.trim() })
          onClose()
        }}
      >
        <Field label={t('field.title')}>
          <input className="input" value={d.title} onChange={set('title')} autoFocus={isNew} />
        </Field>
        <div className="row">
          <Field label={t('field.due')}>
            <input className="input" type="date" value={d.due} onChange={set('due')} />
          </Field>
          <Field label={t('field.status')}>
            <select className="select" value={d.status} onChange={(e) => setD({ ...d, status: e.target.value as TaskStatus })}>
              <option value="planned">{t('task.planned')}</option>
              <option value="in_progress">{t('task.in_progress')}</option>
              <option value="done">{t('task.done')}</option>
            </select>
          </Field>
        </div>
        <Field label={t('field.company')}>
          <select
            className="select"
            value={d.companyId ?? ''}
            onChange={(e) => {
              const companyId = e.target.value || undefined
              const keepPerson = d.personId && companyId && people.find((p) => p.id === d.personId)?.companyIds.includes(companyId)
              setD({ ...d, companyId, personId: keepPerson ? d.personId : companyId ? undefined : d.personId })
            }}
          >
            <option value="">—</option>
            {[...companies].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('field.person')}>
          <select
            className="select"
            value={d.personId ?? ''}
            onChange={(e) => {
              const personId = e.target.value || undefined
              const p = people.find((x) => x.id === personId)
              setD({ ...d, personId, companyId: d.companyId ?? (p?.companyIds.length === 1 ? p.companyIds[0] : undefined) })
            }}
          >
            <option value="">—</option>
            {[...peopleOptions].sort((a, b) => a.lastName.localeCompare(b.lastName)).map((p) => (
              <option key={p.id} value={p.id}>
                {fullName(p)}
              </option>
            ))}
          </select>
        </Field>
      </form>
    </Sheet>
  )
}
