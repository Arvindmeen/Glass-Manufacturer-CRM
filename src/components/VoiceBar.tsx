import { useEffect, useRef } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import { useT } from '../i18n'
import { formatSeconds } from '../lib/useRecorder'

/**
 * Inline recording bar that takes the place of the mic button:
 * cancel · live waveform (voice spikes) · time · done. In "processing" mode the
 * waveform turns into a calm moving wave while the note is transcribed and interpreted.
 */
export function VoiceBar({
  mode,
  seconds,
  getLevel,
  onDone,
  onCancel,
  size = 'lg',
}: {
  mode: 'recording' | 'processing'
  seconds: number
  getLevel: () => number
  onDone: () => void
  onCancel: () => void
  size?: 'lg' | 'sm'
}) {
  const t = useT()
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let levels: number[] = []
    let frame = 0
    let last = 0
    let smooth = 0
    const bar = size === 'lg' ? 4 : 3
    const gap = size === 'lg' ? 3 : 2

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      c.width = Math.max(1, Math.round(c.clientWidth * dpr))
      c.height = Math.max(1, Math.round(c.clientHeight * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.max(8, Math.floor(c.clientWidth / (bar + gap)))
      levels = Array.from({ length: count }, (_, i) => levels[levels.length - count + i] ?? 0)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(c)
    resize()

    const color = getComputedStyle(c).color

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw)
      if (now - last < 50) return // ~20 samples per second: readable spikes
      last = now
      let v: number
      if (mode === 'recording') {
        smooth += (getLevel() - smooth) * 0.6
        v = Math.min(1, Math.pow(smooth, 0.7) * 1.15)
      } else {
        v = reduce ? 0.3 : 0.25 + 0.2 * Math.sin(now / 180)
      }
      levels.push(v)
      levels.shift()

      const w = c.clientWidth
      const h = c.clientHeight
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = color
      const n = levels.length
      const total = n * (bar + gap) - gap
      const x0 = (w - total) / 2
      for (let i = 0; i < n; i++) {
        // Processing: a travelling wave instead of the recorded history.
        const lv = mode === 'recording' ? levels[i] : 0.2 + 0.18 * (1 + Math.sin(now / 160 - i * 0.45))
        const bh = Math.max(bar, lv * (h - 4))
        ctx.globalAlpha = mode === 'recording' ? 0.35 + 0.65 * (i / n) : 0.55
        const x = x0 + i * (bar + gap)
        const y = (h - bh) / 2
        ctx.beginPath()
        ctx.roundRect(x, y, bar, bh, bar / 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }
    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
    }
  }, [mode, getLevel, size])

  // Escape cancels a recording without closing the surrounding sheet.
  useEffect(() => {
    if (mode !== 'recording') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [mode, onCancel])

  const icon = size === 'lg' ? 20 : 16
  return (
    <div className={`voice-bar ${size} ${mode}`} role="status" aria-live="polite">
      {mode === 'recording' ? (
        <button type="button" className="vb-btn vb-cancel" onClick={onCancel} aria-label={t('common.cancel')}>
          <X size={icon} />
        </button>
      ) : (
        <span className="vb-btn vb-spin" aria-hidden>
          <Loader2 size={icon} className="spin" />
        </span>
      )}
      <div className="vb-wave">
        <canvas ref={canvas} aria-hidden />
        <span className="vb-label">{mode === 'recording' ? t('voice.recording') : t('voice.processing')}</span>
      </div>
      {mode === 'recording' && <span className="vb-time">{formatSeconds(seconds)}</span>}
      {mode === 'recording' && (
        <button type="button" className="vb-btn vb-done" onClick={onDone} aria-label={t('voice.stop')}>
          <Check size={icon + 2} strokeWidth={3} />
        </button>
      )}
    </div>
  )
}
