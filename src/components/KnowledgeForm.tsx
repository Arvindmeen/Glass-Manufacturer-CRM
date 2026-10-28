import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useT, type TKey } from '../i18n'
import { chatJSON } from '../lib/openai'
import { deleteKnowledge, saveKnowledge, uid } from '../store/db'
import type { KnowledgeEntry } from '../types'
import { Field, Sheet } from './ui'

export const SECTIONS = ['installation', 'products', 'troubleshooting', 'sales'] as const
export const sectionLabel = (s: string): TKey =>
  (SECTIONS as readonly string[]).includes(s) ? (`kb.${s}` as TKey) : 'kb.all'

export const blankKnowledge = (): KnowledgeEntry => ({
  id: uid(),
  section: 'installation',
  title: '',
  product: '',
  summary: '',
  steps: [],
  tags: [],
  createdAt: new Date().toISOString(),
})

/** Turn a technician's spoken know-how into a structured entry (not saved yet). */
export async function structureKnowledge(text: string): Promise<KnowledgeEntry> {
  const r = await chatJSON<Partial<KnowledgeEntry>>(
    `A technician at a glass manufacturer describes practical know-how by voice.
Turn it into a knowledge base entry. Keep every concrete detail (dimensions, tools, materials, warnings, times).
Return JSON: {"section": one of ${SECTIONS.join('|')}, "title": short title, "product": product it applies to,
"summary": 1-3 sentences, "steps": [{"text": one action per step, "image": 2-4 word caption for an illustration}] (empty if not a procedure),
"tags": 2-5 short keywords}. Write in the language spoken.`,
    text,
  )
  return {
    ...blankKnowledge(),
    section: (SECTIONS as readonly string[]).includes(r.section ?? '') ? r.section! : 'installation',
    title: r.title ?? '',
    product: r.product ?? '',
    summary: r.summary ?? text,
    steps: (r.steps ?? []).map((s) => ({ text: String(s.text ?? ''), image: s.image ? String(s.image) : undefined })),
    tags: (r.tags ?? []).map(String),
  }
}

export function KnowledgeForm({
  entry,
  isNew,
  onClose,
  onSaved,
  onDeleted,
}: {
  entry: KnowledgeEntry
  isNew: boolean
  onClose: () => void
  onSaved?: (k: KnowledgeEntry) => void
  onDeleted?: () => void
}) {
  const t = useT()
  const [d, setD] = useState(entry)
  const [tags, setTags] = useState(entry.tags.join(', '))
  const setStep = (n: number, text: string) =>
    setD({ ...d, steps: d.steps.map((s, k) => (k === n ? { ...s, text } : s)) })

  return (
    <Sheet
      title={isNew ? t('kb.record') : d.title}
      onClose={onClose}
      wide
      footer={
        <>
          {!isNew && (
            <button
              className="btn danger ghost"
              onClick={() => {
                if (confirm(t('common.confirmDelete'))) {
                  deleteKnowledge(d.id)
                  onDeleted?.()
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
            disabled={!d.title.trim()}
            onClick={() => {
              const saved = saveKnowledge({
                ...d,
                steps: d.steps.filter((s) => s.text.trim()),
                tags: tags.split(',').map((x) => x.trim()).filter(Boolean),
              })
              onSaved?.(saved)
              onClose()
            }}
          >
            {t('common.save')}
          </button>
        </>
      }
    >
      <div className="form">
        <div className="row">
          <Field label={t('kb.section')}>
            <select className="select" value={d.section} onChange={(e) => setD({ ...d, section: e.target.value })}>
              {SECTIONS.map((s) => (
                <option key={s} value={s}>
                  {t(sectionLabel(s))}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('kb.product')}>
            <input className="input" value={d.product} onChange={(e) => setD({ ...d, product: e.target.value })} />
          </Field>
        </div>
        <Field label={t('field.title')}>
          <input className="input" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
        </Field>
        <Field label={t('kb.summary')}>
          <textarea className="textarea" rows={3} value={d.summary} onChange={(e) => setD({ ...d, summary: e.target.value })} />
        </Field>
        {d.steps.map((s, n) => (
          <Field key={n} label={t('kb.step', { n: n + 1 })}>
            <div className="row-gap" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
              <textarea className="textarea" rows={2} style={{ minHeight: 60 }} value={s.text} onChange={(e) => setStep(n, e.target.value)} />
              <button
                className="btn ghost icon"
                onClick={() => setD({ ...d, steps: d.steps.filter((_, k) => k !== n) })}
                aria-label={t('common.delete')}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </Field>
        ))}
        <button className="btn small" style={{ justifySelf: 'start' }} onClick={() => setD({ ...d, steps: [...d.steps, { text: '' }] })}>
          <Plus size={16} /> {t('kb.addStep')}
        </button>
        <Field label={t('kb.tags')}>
          <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  )
}
