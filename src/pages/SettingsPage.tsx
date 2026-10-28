import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useT } from '../i18n'
import { resetDemoData } from '../store/db'
import { updateSettings, useSettings, type Lang } from '../store/settings'
import { Field, PageHead, Section, toast } from '../components/ui'

export function SettingsPage() {
  const t = useT()
  const settings = useSettings()
  const [show, setShow] = useState(false)

  return (
    <>
      <PageHead title={t('nav.settings')} />
      <div className="card form" style={{ padding: 16 }}>
        <Field label={t('settings.language')}>
          <div className="segmented">
            {(['de', 'en'] as Lang[]).map((l) => (
              <button key={l} className={settings.lang === l ? 'active' : ''} onClick={() => updateSettings({ lang: l })} type="button">
                {l === 'de' ? 'Deutsch' : 'English'}
              </button>
            ))}
          </div>
        </Field>
        <Field label={t('settings.openaiKey')}>
          <div className="row-gap" style={{ flexWrap: 'nowrap' }}>
            <input
              className="input"
              type={show ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-…"
              value={settings.openaiKey}
              onChange={(e) => updateSettings({ openaiKey: e.target.value.trim() })}
            />
            <button className="btn icon" type="button" onClick={() => setShow((s) => !s)} aria-label="Show key">
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <span className="muted small">{t('settings.keyStored')}</span>
        </Field>
      </div>
      <Section title="Demo">
        <button
          className="btn danger"
          onClick={() => {
            if (confirm(t('settings.resetConfirm'))) {
              resetDemoData()
              toast(t('voice.saved'))
            }
          }}
        >
          {t('settings.resetData')}
        </button>
      </Section>
    </>
  )
}
