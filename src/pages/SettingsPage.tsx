import { useState, useSyncExternalStore, type CSSProperties } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { useT } from '../i18n'
import { KEY_PATTERN, removeKey, saveKey, setKeyMode, subscribeVault, vaultStatus, type KeyMode } from '../lib/keyVault'
import { resetDemoData } from '../store/db'
import { updateSettings, useSettings, type Lang } from '../store/settings'
import { Field, PageHead, Section, toast } from '../components/ui'

// Masked text instead of a password field where supported, so password managers never offer to save the key.
const MASK = typeof CSS !== 'undefined' && CSS.supports('-webkit-text-security', 'disc')

export function SettingsPage() {
  const t = useT()
  const settings = useSettings()
  const vault = useSyncExternalStore(subscribeVault, vaultStatus)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const showInput = !vault.hasKey || editing
  const [mode, setMode] = useState<KeyMode>(vault.mode)

  const submit = async () => {
    const value = draft.trim()
    if (!KEY_PATTERN.test(value)) return setError(t('settings.invalidKey'))
    await saveKey(value, mode)
    // Drop the plaintext from component state right away.
    setDraft('')
    setShow(false)
    setEditing(false)
    setError('')
    toast(t('voice.saved'))
  }

  return (
    <>
      <PageHead title={t('nav.settings')} />
      <div className="card form" style={{ padding: 16 }}>
        <Field label={t('settings.language')} group>
          <div className="segmented">
            {(['en', 'de'] as Lang[]).map((l) => (
              <button key={l} className={settings.lang === l ? 'active' : ''} onClick={() => updateSettings({ lang: l })} type="button">
                {l === 'de' ? 'Deutsch' : 'English'}
              </button>
            ))}
          </div>
        </Field>

        <Field label={t('settings.openaiKey')} group>
          {showInput ? (
            <form
              className="row-gap"
              style={{ flexWrap: 'nowrap' }}
              onSubmit={(e) => {
                e.preventDefault()
                void submit()
              }}
            >
              <input
                className="input"
                type={show || MASK ? 'text' : 'password'}
                style={MASK && !show ? ({ WebkitTextSecurity: 'disc' } as CSSProperties) : undefined}
                name="openai-key"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-1p-ignore
                data-lpignore="true"
                placeholder="sk-…"
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value)
                  setError('')
                }}
                aria-label={t('settings.openaiKey')}
              />
              <button className="btn icon" type="button" onClick={() => setShow((s) => !s)} aria-label={t(show ? 'common.hide' : 'common.show')}>
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
              <button className="btn primary" type="submit" disabled={!draft.trim()}>
                {t('common.save')}
              </button>
              {editing && (
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => {
                    setEditing(false)
                    setDraft('')
                    setError('')
                  }}
                >
                  {t('common.cancel')}
                </button>
              )}
            </form>
          ) : (
            <div className="key-saved">
              <Lock size={16} />
              <span className="grow mono key-dots" aria-label={t('settings.keySaved')}>••••••••••••</span>
              <button className="btn small" type="button" onClick={() => setEditing(true)}>
                {t('settings.replaceKey')}
              </button>
              <button
                className="btn small danger"
                type="button"
                onClick={() => {
                  if (confirm(t('settings.removeKeyConfirm'))) void removeKey()
                }}
              >
                {t('common.delete')}
              </button>
            </div>
          )}
          {error && <span className="error">{error}</span>}
          <div className="segmented small">
            {(['device', 'session'] as KeyMode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={(vault.hasKey && !editing ? vault.mode : mode) === m ? 'active' : ''}
                onClick={() => {
                  setMode(m)
                  if (vault.hasKey && !editing) void setKeyMode(m)
                }}
              >
                {t(m === 'device' ? 'settings.keyDevice' : 'settings.keySessionOnly')}
              </button>
            ))}
          </div>
          <span className="muted small">{!vault.persistent ? t('settings.keySession') : (vault.hasKey && !editing ? vault.mode : mode) === 'session' ? t('settings.keySessionStored') : t('settings.keyStored')}</span>
        </Field>
      </div>
      <Section title={t('settings.demo')}>
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
