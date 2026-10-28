import { useEffect, useRef, useState } from 'react'
import { Mic } from 'lucide-react'
import { useT } from '../i18n'
import { MissingKeyError, transcribe } from '../lib/openai'
import { useRecorder } from '../lib/useRecorder'
import { getSettings } from '../store/settings'
import { VoiceOverlay } from './VoiceOverlay'

/**
 * Record → Done → transcribe. Calls `onText` with the transcript and
 * stays busy until the returned promise settles, so callers can chain AI work.
 */
export function VoiceRecorder({
  onText,
  label,
  big,
  autoStart,
  onCancel,
}: {
  onText: (text: string) => Promise<void> | void
  label?: string
  big?: boolean
  autoStart?: boolean
  onCancel?: () => void
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

  return (
    <div className="stack" style={{ gap: 6 }}>
      <button className={big ? 'btn lg block accent' : 'btn'} onClick={begin} disabled={busy}>
        <Mic size={18} /> {label ?? t('voice.start')}
      </button>
      {rec.state === 'denied' && <span className="error">{t('voice.micDenied')}</span>}
      {error && <span className="error">{error}</span>}
      {(rec.state === 'recording' || busy) && (
        <VoiceOverlay
          mode={busy ? 'processing' : 'recording'}
          seconds={rec.seconds}
          getLevel={rec.getLevel}
          onDone={() => void finish()}
          onCancel={() => {
            rec.cancel()
            onCancel?.()
          }}
        />
      )}
    </div>
  )
}
