import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronRight, Mic, Plus } from 'lucide-react'
import { useLocale, useT } from '../i18n'
import { dueState, formatDate } from '../lib/format'
import { fullName, saveTask, useDB } from '../store/db'
import type { Meeting, Task, TaskStatus } from '../types'
import { TaskForm } from './forms'
import { MeetingForm } from './MeetingForm'
import { Section } from './ui'

const nextStatus: Record<TaskStatus, TaskStatus> = { planned: 'in_progress', in_progress: 'done', done: 'planned' }

export function TaskCard({ task, showLinks = true, onOpen }: { task: Task; showLinks?: boolean; onOpen: () => void }) {
  const t = useT()
  const locale = useLocale()
  const { companies, people } = useDB()
  const company = companies.find((c) => c.id === task.companyId)
  const person = people.find((p) => p.id === task.personId)
  const due = task.status === 'done' ? '' : dueState(task.due)

  return (
    <div
      className={`task${task.status === 'done' ? ' done' : ''}`}
      onClick={onOpen}
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/task', task.id)}
    >
      <button
        className="advance"
        title={t(`task.${nextStatus[task.status]}`)}
        aria-label={t(`task.${nextStatus[task.status]}`)}
        onClick={(e) => {
          e.stopPropagation()
          saveTask({ ...task, status: nextStatus[task.status] })
        }}
      >
        {task.status === 'done' ? <Check size={16} /> : task.status === 'in_progress' ? <ChevronRight size={16} /> : null}
      </button>
      <div className="grow">
        <div className="title">{task.title}</div>
        <div className="meta">
          {task.due && (
            <span className={`chip${due === 'overdue' ? ' danger' : due === 'today' ? ' warn' : ''}`}>
              {due === 'today' ? t('common.today') : formatDate(task.due, locale, { year: undefined })}
            </span>
          )}
          {showLinks && company && <span className="chip primary">{company.name}</span>}
          {showLinks && person && <span className="chip">{fullName(person)}</span>}
        </div>
      </div>
    </div>
  )
}

export function TasksSection({ filter, defaults }: { filter: (t: Task) => boolean; defaults: Partial<Task> }) {
  const t = useT()
  const { tasks } = useDB()
  const [editing, setEditing] = useState<Task | 'new' | null>(null)
  const list = tasks
    .filter(filter)
    .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || (a.due || '9').localeCompare(b.due || '9'))

  return (
    <Section
      title={t('task.title')}
      action={
        <button className="btn small" onClick={() => setEditing('new')}>
          <Plus size={16} /> {t('common.add')}
        </button>
      }
    >
      <div className="card task-list">
        {list.length === 0 && <div className="empty">{t('common.none')}</div>}
        {list.map((task) => (
          <TaskCard key={task.id} task={task} showLinks={false} onOpen={() => setEditing(task)} />
        ))}
      </div>
      {editing && (
        <TaskForm task={editing === 'new' ? undefined : editing} defaults={defaults} onClose={() => setEditing(null)} />
      )}
    </Section>
  )
}

export function MeetingsSection({ filter, defaults }: { filter: (m: Meeting) => boolean; defaults: Partial<Meeting> }) {
  const t = useT()
  const locale = useLocale()
  const { meetings, people } = useDB()
  const [editing, setEditing] = useState<{ meeting?: Meeting; voice?: boolean } | null>(null)
  const list = meetings.filter(filter).sort((a, b) => b.date.localeCompare(a.date))

  return (
    <Section
      title={t('meeting.title')}
      action={
        <div className="row-gap">
          <button className="btn small accent" onClick={() => setEditing({ voice: true })} aria-label={t('meeting.byVoice')}>
            <Mic size={16} />
          </button>
          <button className="btn small" onClick={() => setEditing({})}>
            <Plus size={16} /> {t('common.add')}
          </button>
        </div>
      }
    >
      <div className="card">
        {list.length === 0 && <div className="empty">{t('common.none')}</div>}
        {list.map((m) => (
          <div key={m.id} className="meeting" onClick={() => setEditing({ meeting: m })}>
            <div className="meta">
              <span>{formatDate(m.date, locale)}</span>
              {m.personIds.length > 0 && (
                <span>
                  ·{' '}
                  {m.personIds
                    .map((id) => people.find((p) => p.id === id))
                    .filter(Boolean)
                    .map((p) => fullName(p!))
                    .join(', ')}
                </span>
              )}
            </div>
            {m.title && <div style={{ fontWeight: 600 }}>{m.title}</div>}
            <div className="summary">{m.summary}</div>
          </div>
        ))}
      </div>
      {editing && (
        <MeetingForm
          meeting={editing.meeting}
          defaults={defaults}
          startWithVoice={editing.voice}
          onClose={() => setEditing(null)}
        />
      )}
    </Section>
  )
}

export function LinkedList({ items }: { items: { id: string; to: string; title: string; sub: string; avatar: React.ReactNode }[] }) {
  const t = useT()
  return (
    <div className="list">
      {items.length === 0 && <div className="empty">{t('common.none')}</div>}
      {items.map((i) => (
        <Link key={i.id} to={i.to} className="list-item">
          {i.avatar}
          <div className="grow">
            <div className="title">{i.title}</div>
            <div className="sub">{i.sub}</div>
          </div>
          <ChevronRight size={18} className="muted" />
        </Link>
      ))}
    </div>
  )
}
