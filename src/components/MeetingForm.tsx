import { useState } from 'react'
import { useT } from '../i18n'
import { chatJSON } from '../lib/openai'
import { todayISO } from '../lib/format'
import { blankMeeting, deleteMeeting, fullName, saveMeeting, useDB } from '../store/db'
import type { Meeting } from '../types'
import { Field, Sheet } from './ui'
import { VoiceRecorder } from './VoiceRecorder'

interface VoiceMeeting {
  title?: string
  summary?: string
  date?: string
  participantIds?: string[]
}

export function MeetingForm({
  meeting,
  defaults,
  onClose,
  startWithVoice,
}: {
  meeting?: Meeting
  defaults?: Partial<Meeting>
  onClose: () => void
  startWithVoice?: boolean
}) {
  const t = useT()
  const { people, companies } = useDB()
  const [d, setD] = useState(meeting ?? blankMeeting(defaults))
  const isNew = !meeting

  const candidates = people.filter(
    (p) => d.personIds.includes(p.id) || p.companyIds.some((c) => d.companyIds.includes(c)),
  )
  const others = people.filter((p) => !candidates.includes(p))

  const toggle = (key: 'personIds' | 'companyIds', id: string) =>
    setD((x) => ({ ...x, [key]: x[key].includes(id) ? x[key].filter((v) => v !== id) : [...x[key], id] }))

  const fillFromVoice = async (text: string) => {
    const list = candidates.map((p) => `${p.id}: ${fullName(p)} (${p.role})`).join('\n')
    const r = await chatJSON<VoiceMeeting>(
      `You turn a sales rep's spoken meeting note into a CRM meeting record.
Today is ${todayISO()}. Reply in the language of the note.
Return JSON: {"title": short title (max 6 words), "summary": concise summary of what was discussed, keep all facts, numbers, products and agreements, use short lines, "date": "YYYY-MM-DD" only if a meeting date is mentioned, "participantIds": ids from the candidate list that took part}.
Candidates:
${list || '(none)'}`,
      text,
    )
    setD((x) => ({
      ...x,
      title: r.title || x.title,
      summary: [x.summary, r.summary || text].filter(Boolean).join('\n'),
      date: r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : x.date,
      personIds: [...new Set([...x.personIds, ...(r.participantIds ?? []).filter((id) => people.some((p) => p.id === id))])],
    }))
  }

  return (
    <Sheet
      title={isNew ? t('meeting.new') : d.title || t('meeting.title')}
      onClose={onClose}
      footer={
        <>
          {!isNew && (
            <button
              className="btn danger ghost"
              onClick={() => {
                if (confirm(t('common.confirmDelete'))) {
                  deleteMeeting(d.id)
                  onClose()
                }
              }}
            >
              {t('common.delete')}
            </button>
          )}
          <span className="grow" />
          <button className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            className="btn primary"
            disabled={!d.summary.trim() && !d.title.trim()}
            onClick={() => {
              saveMeeting(d)
              onClose()
            }}
          >
            {t('common.save')}
          </button>
        </>
      }
    >
      <div className="form">
        <VoiceRecorder big label={t('meeting.byVoice')} onText={fillFromVoice} autoStart={startWithVoice} />
        <div className="row">
          <Field label={t('field.date')}>
            <input className="input" type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} />
          </Field>
          <Field label={t('field.title')}>
            <input className="input" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
          </Field>
        </div>
        <Field label={t('field.summary')}>
          <textarea
            className="textarea"
            rows={6}
            value={d.summary}
            onChange={(e) => setD({ ...d, summary: e.target.value })}
          />
        </Field>
        <Field label={t('field.people')}>
          <div className="chips">
            {candidates.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`chip${d.personIds.includes(p.id) ? ' primary' : ''}`}
                onClick={() => toggle('personIds', p.id)}
              >
                {fullName(p)}
              </button>
            ))}
          </div>
          {others.length > 0 && (
            <select className="select" value="" onChange={(e) => e.target.value && toggle('personIds', e.target.value)}>
              <option value="">+ {t('field.person')}</option>
              {others.map((p) => (
                <option key={p.id} value={p.id}>
                  {fullName(p)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={t('field.companies')}>
          <div className="chips">
            {d.companyIds.map((id) => (
              <button key={id} type="button" className="chip primary" onClick={() => toggle('companyIds', id)}>
                {companies.find((c) => c.id === id)?.name ?? '?'} ×
              </button>
            ))}
          </div>
          <select className="select" value="" onChange={(e) => e.target.value && toggle('companyIds', e.target.value)}>
            <option value="">+ {t('field.company')}</option>
            {companies
              .filter((c) => !d.companyIds.includes(c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </Field>
      </div>
    </Sheet>
  )
}
