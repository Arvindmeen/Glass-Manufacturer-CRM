import { useState } from 'react'
import { useT } from '../i18n'
import { chatJSON, text as asText } from '../lib/openai'
import { todayISO } from '../lib/format'
import { blankMeeting, deleteMeeting, fullName, saveMeeting, useDB } from '../store/db'
import type { Meeting } from '../types'
import { DatePicker, RemovableChip, Select, ToggleChips } from './Dropdown'
import { companyOptions, personOptions } from './options'
import { Field, Sheet, useClosing } from './ui'
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
  const [closing, close] = useClosing(onClose)
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
    const date = asText(r.date)
    const ids = Array.isArray(r.participantIds) ? r.participantIds : []
    setD((x) => ({
      ...x,
      title: asText(r.title) || x.title,
      summary: [x.summary, asText(r.summary) || text].filter(Boolean).join('\n'),
      date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : x.date,
      personIds: [...new Set([...x.personIds, ...ids.filter((id) => people.some((p) => p.id === id))])],
    }))
  }

  return (
    <Sheet
      title={isNew ? t('meeting.new') : d.title || t('meeting.title')}
      onClose={close} closing={closing}
      footer={
        <>
          {!isNew && (
            <button
              className="btn danger ghost"
              onClick={() => {
                if (confirm(t('common.confirmDelete'))) {
                  deleteMeeting(d.id)
                  close()
                }
              }}
            >
              {t('common.delete')}
            </button>
          )}
          <span className="grow" />
          <button className="btn" onClick={close}>
            {t('common.cancel')}
          </button>
          <button
            className="btn primary"
            disabled={!d.summary.trim() && !d.title.trim()}
            onClick={() => {
              saveMeeting(d)
              close()
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
          <Field label={t('field.date')} group>
            <DatePicker label={t('field.date')} value={d.date} onChange={(date) => setD({ ...d, date })} />
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
        <Field label={t('field.people')} group>
          <ToggleChips
            options={candidates.map((p) => ({ value: p.id, label: fullName(p) }))}
            selected={d.personIds}
            onToggle={(id) => toggle('personIds', id)}
          />
          {others.length > 0 && (
            <div>
              <Select
                variant="add"
                label={t('field.person')}
                options={personOptions(others, companies)}
                onChange={(v) => v && toggle('personIds', v)}
              />
            </div>
          )}
        </Field>
        <Field label={t('field.companies')} group>
          <div className="chips">
            {d.companyIds.map((id) => (
              <RemovableChip key={id} label={companies.find((c) => c.id === id)?.name ?? '?'} onRemove={() => toggle('companyIds', id)} />
            ))}
            <Select
              variant="add"
              label={t('field.company')}
              options={companyOptions(companies.filter((c) => !d.companyIds.includes(c.id)))}
              onChange={(v) => v && toggle('companyIds', v)}
            />
          </div>
        </Field>
      </div>
    </Sheet>
  )
}
