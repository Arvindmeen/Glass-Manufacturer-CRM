import { useEffect, useRef, useState } from 'react'
import { Mic } from 'lucide-react'
import { useT } from '../i18n'
import { MissingKeyError, transcribe } from '../lib/openai'
import { useRecorder } from '../lib/useRecorder'
import { vaultStatus } from '../lib/keyVault'
import { ErrorText } from './ui'
import { VoiceBar } from './VoiceBar'

const MAX_SECONDS = 600

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
  onError,
  variant = big ? 'block' : 'button',
  onActiveChange,
}: {
  onText: (text: string) => Promise<void> | void
  label?: string
  big?: boolean
  autoStart?: boolean
  onCancel?: () => void
  /** When set, errors are reported here instead of inline. */
  onError?: (msg: string) => void
  /** block: full-width button → large bar; button: normal button; icon: mic icon → compact bar. */
  variant?: 'block' | 'button' | 'icon'
  /** Tells the parent when the bar is showing (e.g. to hide a text input next to it). */
  onActiveChange?: (active: boolean) => void
}) {
  const t = useT()
  const rec = useRecorder()
  const [busy, setBusy] = useState(false)
  const [inlineError, setInlineError] = useState('')
  const setError = (msg: string) => (onError && msg ? onError(msg) : setInlineError(msg))
  const error = inlineError
  const started = useRef(false)

  const begin = () => {
    if (!vaultStatus().hasKey) return setError(t('voice.noKey'))
    setError('')
    void rec.start()
  }

  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true
      begin()
    }
  })

  useEffect(() => {
    if (rec.state === 'denied' && onError) onError(t('voice.micDenied'))
  }, [rec.state, onError, t])

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

  const active = rec.state === 'recording' || busy
  const reported = useRef(false)
  useEffect(() => {
    if (reported.current === active) return
    reported.current = active
    onActiveChange?.(active)
  }, [active, onActiveChange])

  // Safety stop: very long recordings exceed what one transcription request accepts.
  useEffect(() => {
    if (rec.state === 'recording' && rec.seconds >= MAX_SECONDS) void finish()
  })

  const cancel = () => {
    rec.cancel()
    onCancel?.()
  }

  return (
    <div className={`voice-recorder ${variant}${active ? ' active' : ''}`}>
      {active ? (
        <VoiceBar
          size={variant === 'block' ? 'lg' : 'sm'}
          mode={busy ? 'processing' : 'recording'}
          seconds={rec.seconds}
          getLevel={rec.getLevel}
          onDone={() => void finish()}
          onCancel={cancel}
        />
      ) : variant === 'icon' ? (
        <button type="button" className="btn icon" onClick={begin} aria-label={label ?? t('voice.start')}>
          <Mic size={18} />
        </button>
      ) : (
        <button type="button" className={variant === 'block' ? 'btn lg block accent' : 'btn'} onClick={begin}>
          <Mic size={18} /> {label ?? t('voice.start')}
        </button>
      )}
      {rec.state === 'denied' && !onError && <span className="error">{t('voice.micDenied')}</span>}
      <ErrorText msg={error} noKeyMsg={t('voice.noKey')} />
    </div>
  )
}
