import { useState, type FormEvent, type ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { useT } from '../i18n'

/**
 * Simple site password, so the public deployment is not open to everyone.
 * Not a user login: one shared password, checked against its SHA-256 hash (the password itself is
 * not in the code), and remembered on this device once entered.
 */
const PASSWORD_SHA256 = 'f3831c5e70ff9070c475c48c825cca87fc978a49c9f11ccef7e6d83a4d593261'
const STORAGE_KEY = 'glasscrm:gate'

async function sha256(text: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function isUnlocked() {
  try {
    return localStorage.getItem(STORAGE_KEY) === PASSWORD_SHA256
  } catch {
    return false
  }
}

export function PasswordGate({ children }: { children: ReactNode }) {
  const t = useT()
  const [unlocked, setUnlocked] = useState(isUnlocked)
  const [value, setValue] = useState('')
  const [wrong, setWrong] = useState(false)
  const [busy, setBusy] = useState(false)

  if (unlocked) return <>{children}</>

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const ok = (await sha256(value)) === PASSWORD_SHA256
    setBusy(false)
    if (!ok) {
      setWrong(true)
      return
    }
    try {
      localStorage.setItem(STORAGE_KEY, PASSWORD_SHA256)
    } catch {
      // storage blocked: stay unlocked for this visit only
    }
    setUnlocked(true)
  }

  return (
    <div className="gate">
      <form className="card gate-card" onSubmit={submit}>
        <div className="gate-icon">
          <Lock size={22} />
        </div>
        <div className="brand">Glass CRM</div>
        <p className="muted small">{t('gate.prompt')}</p>
        <input
          className="input"
          type="password"
          autoFocus
          autoComplete="current-password"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setWrong(false)
          }}
          placeholder={t('gate.password')}
          aria-label={t('gate.password')}
          aria-invalid={wrong}
        />
        {wrong && <span className="error">{t('gate.wrong')}</span>}
        <button className="btn primary" type="submit" disabled={busy || !value}>
          {t('gate.enter')}
        </button>
      </form>
    </div>
  )
}
