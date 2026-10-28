import { useEffect, useRef, useState } from 'react'
import { Loader2, Mic, Square } from 'lucide-react'
import { useT } from '../i18n'
import { MissingKeyError, transcribe } from '../lib/openai'
import { formatSeconds, useRecorder } from '../lib/useRecorder'
import { getSettings } from '../store/settings'

/**
 * Record → Done → transcribe. Calls `onText` with the transcript and
 * stays busy until the returned promise settles, so callers can chain AI work.
 */
export function VoiceRecorder({
  onText,
  label,
  big,
  autoStart,
}: {
  onText: (text: string) => Promise<void> | void
  label?: string
  big?: boolean
  autoStart?: boolean
}) {
  const t = useT()
  const rec = useRecorder()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const started = useRef(false)

  const begin = () => {
    if (!getSettings().openaiKey) return setError(t('voice.noKey'))
    setError('')
    void rec.start()
  }

  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true
      begin()
    }
  })

  const finish = async () => {
    const blob = await rec.stop()
    if (!blob.size) return
    setBusy(true)
    setError('')
    try {
      const text = await transcribe(blob)
      await onText(text)
    } catch (e) {
      setError(e instanceof MissingKeyError ? t('voice.noKey') : t('voice.error', { msg: (e as Error).message }))
    } finally {
      setBusy(false)
    }
  }

  const size = big ? 'btn lg block' : 'btn'
  return (
    <div className="stack" style={{ gap: 6 }}>
      {busy ? (
        <button className={`${size}`} disabled>
          <Loader2 size={18} className="spin" /> {t('voice.processing')}
        </button>
      ) : rec.state === 'recording' ? (
        <button className={`${size} accent pulse`} onClick={finish}>
          <Square size={16} fill="currentColor" /> {t('voice.stop')} · {formatSeconds(rec.seconds)}
        </button>
      ) : (
        <button className={`${size} ${big ? 'accent' : ''}`} onClick={begin}>
          <Mic size={18} /> {label ?? t('voice.start')}
        </button>
      )}
      {rec.state === 'denied' && <span className="error">{t('voice.micDenied')}</span>}
      {error && <span className="error">{error}</span>}
    </div>
  )
}
