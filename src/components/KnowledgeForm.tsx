import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useT, type TKey } from '../i18n'
import { deleteKnowledge, saveKnowledge, uid } from '../store/db'
import type { KnowledgeEntry } from '../types'
import { isSafeImage } from '../lib/image'
import { Select } from './Dropdown'
import { PhotoPicker } from './PhotoPicker'
import { Field, Sheet, useClosing } from './ui'

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
  const [closing, close] = useClosing(onClose)
  const [d, setD] = useState(entry)
  const [tags, setTags] = useState(entry.tags.join(', '))
  const setStep = (n: number, text: string) =>
    setD({ ...d, steps: d.steps.map((s, k) => (k === n ? { ...s, text } : s)) })
  const setPhoto = (n: number, photo: string | undefined) =>
    setD({ ...d, steps: d.steps.map((s, k) => (k === n ? { ...s, photo } : s)) })

  return (
    <Sheet
      title={isNew ? t('kb.record') : d.title}
      onClose={close} closing={closing}
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
          <button className="btn" onClick={close}>
            {t('common.cancel')}
          </button>
          <button
            className="btn primary"
            disabled={!d.title.trim()}
            onClick={() => {
              const saved = saveKnowledge({
                ...d,
                steps: d.steps.filter((s) => s.text.trim() || s.photo),
                tags: tags.split(',').map((x) => x.trim()).filter(Boolean),
              })
              onSaved?.(saved)
              close()
            }}
          >
            {t('common.save')}
          </button>
        </>
      }
    >
      <div className="form">
        <div className="row">
          <Field label={t('kb.section')} group>
            <Select
              label={t('kb.section')}
              value={d.section}
              options={SECTIONS.map((x) => ({ value: x, label: t(sectionLabel(x)) }))}
              onChange={(v) => v && setD({ ...d, section: v })}
            />
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
            <div className="step-edit">
              {isSafeImage(s.photo) ? (
                <button type="button" className="step-thumb" onClick={() => setPhoto(n, undefined)} aria-label={t('kb.removePhoto')}>
                  <img src={s.photo} alt="" />
                  <span>×</span>
                </button>
              ) : (
                <PhotoPicker iconOnly onPhotos={([p]) => setPhoto(n, p)} />
              )}
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
        <div className="row-gap">
          <button className="btn small" onClick={() => setD({ ...d, steps: [...d.steps, { text: '' }] })}>
            <Plus size={16} /> {t('kb.addStep')}
          </button>
          <PhotoPicker multiple label={t('kb.addPhotos')} onPhotos={(photos) => setD({ ...d, steps: [...d.steps, ...photos.map((photo) => ({ text: '', photo }))] })} />
        </div>
        <Field label={t('kb.tags')}>
          <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  )
}
