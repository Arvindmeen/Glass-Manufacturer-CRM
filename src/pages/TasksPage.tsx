import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useT } from '../i18n'
import { saveTask, useDB } from '../store/db'
import type { Task, TaskStatus } from '../types'
import { TaskForm } from '../components/forms'
import { TaskCard } from '../components/related'
import { PageHead } from '../components/ui'

const columns: TaskStatus[] = ['planned', 'in_progress', 'done']

export function TasksPage() {
  const t = useT()
  const { tasks } = useDB()
  const [current, setCurrent] = useState<TaskStatus>('planned')
  const [editing, setEditing] = useState<Task | 'new' | null>(null)
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null)

  const byStatus = (s: TaskStatus) =>
    tasks
      .filter((x) => x.status === s)
      .sort((a, b) =>
        s === 'done' ? b.createdAt.localeCompare(a.createdAt) : (a.due || '9').localeCompare(b.due || '9'),
      )

  return (
    <>
      <PageHead title={t('task.title')}>
        <button className="btn primary icon" onClick={() => setEditing('new')} aria-label={t('task.new')}>
          <Plus size={20} />
        </button>
      </PageHead>

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
