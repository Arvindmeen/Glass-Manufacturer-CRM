import { useCallback, useEffect, useRef, useState } from 'react'

export type RecorderState = 'idle' | 'recording' | 'denied'

const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']

export function useRecorder() {
  const [state, setState] = useState<RecorderState>('idle')
  const [seconds, setSeconds] = useState(0)
  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const timer = useRef<number | undefined>(undefined)
  const audio = useRef<{ ctx: AudioContext; analyser: AnalyserNode; data: Uint8Array<ArrayBuffer> } | null>(null)
  /** Bumped by cancel so a microphone grant that arrives late is released at once. */
  const session = useRef(0)
  const mounted = useRef(false)

  const cleanup = useCallback(() => {
    window.clearInterval(timer.current)
    recorder.current?.stream.getTracks().forEach((t) => t.stop())
    recorder.current = null
    void audio.current?.ctx.close()
    audio.current = null
  }, [])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      cleanup()
    }
  }, [cleanup])

  const start = useCallback(async () => {
    const mine = ++session.current
    try {
      // Mono speech is all transcription needs; it keeps the upload small.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
      if (mine !== session.current || !mounted.current) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      const mimeType = preferredTypes.find((t) => MediaRecorder.isTypeSupported(t))
      // 32 kbit/s is plenty for speech (browsers default to ~128) and uploads ~4x faster on mobile data.
      const rec = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 32_000 })
      chunks.current = []
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data)
      rec.start()
      recorder.current = rec
      try {
        const ctx = new AudioContext()
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        ctx.createMediaStreamSource(stream).connect(analyser)
        void ctx.resume() // iOS starts audio contexts suspended
        audio.current = { ctx, analyser, data: new Uint8Array(analyser.fftSize) }
      } catch {
        // level meter is optional
      }
      setSeconds(0)
      timer.current = window.setInterval(() => setSeconds((s) => s + 1), 1000)
      setState('recording')
    } catch {
      setState('denied')
    }
  }, [])

  /** Current input loudness, 0..1. Cheap enough to call every animation frame. */
  const getLevel = useCallback(() => {
    const a = audio.current
    if (!a) return 0
    a.analyser.getByteTimeDomainData(a.data)
    let sum = 0
    for (const v of a.data) sum += ((v - 128) / 128) ** 2
    return Math.min(1, Math.sqrt(sum / a.data.length) * 4)
  }, [])

  const stop = useCallback(
    () =>
      new Promise<Blob>((resolve) => {
        const rec = recorder.current
        if (!rec) return resolve(new Blob())
        rec.onstop = () => {
          const blob = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' })
          cleanup()
          setState('idle')
          resolve(blob)
        }
        rec.stop()
      }),
    [cleanup],
  )

  const cancel = useCallback(() => {
    session.current++
    if (recorder.current) recorder.current.onstop = null
    if (recorder.current?.state === 'recording') recorder.current.stop()
    cleanup()
    setState('idle')
  }, [cleanup])

  return { state, seconds, start, stop, cancel, getLevel }
}

export const formatSeconds = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
