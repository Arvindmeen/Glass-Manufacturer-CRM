import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Check, X } from 'lucide-react'
import { useT } from '../i18n'
import { formatSeconds } from '../lib/useRecorder'

/** Full-screen recording view with a voice-reactive glow (Gemini Live style). */
export function VoiceOverlay({
  mode,
  seconds,
  getLevel,
  onDone,
  onCancel,
}: {
  mode: 'recording' | 'processing'
  seconds: number
  getLevel: () => number
  onDone: () => void
  onCancel: () => void
}) {
  const t = useT()
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (mode !== 'recording') return
    let smooth = 0
    let frame = 0
    const tick = () => {
      smooth += (getLevel() - smooth) * 0.25
      root.current?.style.setProperty('--lvl', smooth.toFixed(3))
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [mode, getLevel])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return createPortal(
    <div ref={root} className={`voice-overlay ${mode}`} role="dialog" aria-modal="true">
      <div className="voice-status">
        <div className="voice-label">{mode === 'recording' ? t('voice.recording') : t('voice.processing')}</div>
        {mode === 'recording' && <div className="voice-time">{formatSeconds(seconds)}</div>}
      </div>

      <div className="voice-glow" aria-hidden>
        <span className="b1" />
        <span className="b2" />
        <span className="b3" />
        <span className="b4" />
      </div>

      {mode === 'recording' && (
        <div className="voice-controls">
          <button className="voice-ctl cancel" onClick={onCancel} aria-label={t('common.cancel')}>
            <X size={26} />
          </button>
          <button className="voice-ctl done" onClick={onDone} aria-label={t('voice.stop')}>
            <Check size={34} />
          </button>
          <span className="voice-ctl spacer" />
        </div>
      )}
    </div>,
    document.body,
  )
}
