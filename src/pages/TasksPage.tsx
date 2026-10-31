import { useState } from 'react'
import { Check, Plus, SlidersHorizontal, X } from 'lucide-react'
import { useT } from '../i18n'
import { fullName, saveTask, useDB } from '../store/db'
import type { Task, TaskStatus } from '../types'
import { TaskForm } from '../components/forms'
import { TaskCard } from '../components/related'
import { AskButton } from '../components/AskChat'
import { Field, PageHead } from '../components/ui'
import { Select } from '../components/Dropdown'
import { localISO, todayISO } from '../lib/format'

const columns: TaskStatus[] = ['planned', 'in_progress', 'done']

type DueFilter = 'overdue' | 'today' | 'week' | 'none'
type SortBy = 'due' | 'company' | 'title' | 'newest'
interface TaskFilter {
  companyId?: string
  personId?: string
  due?: DueFilter
  sort?: SortBy
}

const byDue = (a: Task, b: Task) => (a.due || '9').localeCompare(b.due || '9')
const byNewest = (a: Task, b: Task) => b.createdAt.localeCompare(a.createdAt)

export function TasksPage() {
  const t = useT()
  const { tasks, companies, people } = useDB()
  const [current, setCurrent] = useState<TaskStatus>('planned')
  const [editing, setEditing] = useState<Task | 'new' | null>(null)
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null)
  const [showFilter, setShowFilter] = useState(false)
  /** What is picked in the panel; it only takes effect with the Apply button. */
  const [draft, setDraft] = useState<TaskFilter>({})
  const [filter, setFilter] = useState<TaskFilter>({})
  const activeCount = [filter.companyId, filter.personId, filter.due, filter.sort].filter(Boolean).length

  const companyName = (id?: string) => companies.find((c) => c.id === id)?.name ?? ''
  const today = todayISO()
  const weekEnd = localISO(new Date(new Date(today).getTime() + 7 * 86_400_000))
  const dueMatches = (task: Task) => {
    switch (filter.due) {
      case 'overdue':
        return !!task.due && task.due < today && task.status !== 'done'
      case 'today':
        return task.due === today
      case 'week':
        return !!task.due && task.due >= today && task.due <= weekEnd
      case 'none':
        return !task.due
      default:
        return true
    }
  }
  const compare = (s: TaskStatus) => (a: Task, b: Task) => {
    switch (filter.sort) {
      case 'company':
        // Tasks without a company go last; same company → by due date.
        return (companyName(a.companyId) || '￿').localeCompare(companyName(b.companyId) || '￿') || byDue(a, b)
      case 'title':
        return a.title.localeCompare(b.title)
      case 'newest':
        return byNewest(a, b)
      case 'due':
        return byDue(a, b)
      default:
        return s === 'done' ? byNewest(a, b) : byDue(a, b)
    }
  }

  const byStatus = (s: TaskStatus) =>
    tasks
      .filter((x) => x.status === s)
      .filter((x) => (!filter.companyId || x.companyId === filter.companyId) && (!filter.personId || x.personId === filter.personId) && dueMatches(x))
      .sort(compare(s))

  // Only companies and people that have tasks are offered; people narrow to the chosen company.
  const companyOptions = companies
    .filter((c) => tasks.some((x) => x.companyId === c.id))
    .map((c) => ({ value: c.id, label: c.name }))
    .sort((a, b) => a.label.localeCompare(b.label))
  const personOptions = people
    .filter((p) => tasks.some((x) => x.personId === p.id) && (!draft.companyId || p.companyIds.includes(draft.companyId)))
    .map((p) => ({ value: p.id, label: fullName(p), sub: companyName(p.companyIds[0]) }))
    .sort((a, b) => a.label.localeCompare(b.label))
  const apply = () => {
    setFilter(draft)
    setShowFilter(false)
  }
  const reset = () => {
    setDraft({})
    setFilter({})
  }

  return (
    <>
      <PageHead
        title={t('task.title')}
        fabs={
          <>
            <AskButton />
            <button className="btn primary icon fab-main" onClick={() => setEditing('new')} aria-label={t('task.new')}>
              <Plus size={22} />
            </button>
          </>
        }
      />

      <div className="task-filter-bar">
        <button
          className={`btn${showFilter || activeCount ? ' on' : ''}`}
          onClick={() => {
            if (!showFilter) setDraft(filter)
            setShowFilter((v) => !v)
          }}
          aria-expanded={showFilter}
        >
          <SlidersHorizontal size={16} /> {t('task.filterSort')}
          {activeCount > 0 && <span className="chip">{activeCount}</span>}
        </button>
        {activeCount > 0 && (
          <button className="btn ghost" onClick={reset}>
            <X size={16} /> {t('task.filterReset')}
          </button>
        )}
      </div>

      {showFilter && (
        <div className="card task-filter">
          <div className="task-filter-grid">
            <Field label={t('field.company')} group>
              <Select
                label={t('field.company')}
                value={draft.companyId}
                options={companyOptions}
                placeholder={t('task.filterAll')}
                clearable
                onChange={(companyId) => setDraft((d) => ({ ...d, companyId, personId: undefined }))}
              />
            </Field>
            <Field label={t('field.person')} group>
              <Select
                label={t('field.person')}
                value={draft.personId}
                options={personOptions}
                placeholder={t('task.filterAll')}
                clearable
                onChange={(personId) => setDraft((d) => ({ ...d, personId }))}
              />
            </Field>
            <Field label={t('field.due')} group>
              <Select
                label={t('field.due')}
                value={draft.due}
                options={(['overdue', 'today', 'week', 'none'] as const).map((v) => ({ value: v, label: t(`task.due_${v}`) }))}
                placeholder={t('task.filterAll')}
                clearable
                onChange={(due) => setDraft((d) => ({ ...d, due: due as DueFilter | undefined }))}
              />
            </Field>
            <Field label={t('task.sortBy')} group>
              <Select
                label={t('task.sortBy')}
                value={draft.sort ?? 'due'}
                options={(['due', 'company', 'title', 'newest'] as const).map((v) => ({ value: v, label: t(`task.sort_${v}`) }))}
                onChange={(sort) => setDraft((d) => ({ ...d, sort: sort === 'due' ? undefined : (sort as SortBy | undefined) }))}
              />
            </Field>
          </div>
          <div className="row-gap" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setDraft({})}>
              {t('task.filterReset')}
            </button>
            <button className="btn primary" onClick={apply}>
              <Check size={16} /> {t('task.filterApply')}
            </button>
          </div>
        </div>
      )}

      <div className="segmented board-tabs" style={{ marginBottom: 12 }}>
        {columns.map((s) => (
          <button key={s} className={current === s ? 'active' : ''} onClick={() => setCurrent(s)}>
            {t(`task.${s}`)} · {byStatus(s).length}
          </button>
        ))}
      </div>

      <div className="board">
        {columns.map((s) => {
          const list = byStatus(s)
          return (
            <div
              key={s}
              className={`column${current === s ? ' current' : ''}${dragOver === s ? ' drag-over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(s)
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => {
                setDragOver(null)
                const task = tasks.find((x) => x.id === e.dataTransfer.getData('text/task'))
                if (task && task.status !== s) saveTask({ ...task, status: s })
              }}
            >
              <div className="column-head">
                <span>{t(`task.${s}`)}</span>
                <span className="chip">{list.length}</span>
              </div>
              {list.length === 0 && <div className="empty">{t('common.none')}</div>}
              {list.map((task) => (
                <TaskCard key={task.id} task={task} onOpen={() => setEditing(task)} />
              ))}
            </div>
          )
        })}
      </div>

      {editing && (
        <TaskForm
          task={editing === 'new' ? undefined : editing}
          defaults={{ status: current }}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
