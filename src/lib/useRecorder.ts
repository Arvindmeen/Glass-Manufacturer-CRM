import { useCallback, useEffect, useRef, useState } from 'react'

export type RecorderState = 'idle' | 'recording' | 'denied'

const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']

export function useRecorder() {
  const [state, setState] = useState<RecorderState>('idle')
  const [seconds, setSeconds] = useState(0)
  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const timer = useRef<number | undefined>(undefined)

  const cleanup = useCallback(() => {
    window.clearInterval(timer.current)
    recorder.current?.stream.getTracks().forEach((t) => t.stop())
    recorder.current = null
  }, [])

  useEffect(() => cleanup, [cleanup])

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = preferredTypes.find((t) => MediaRecorder.isTypeSupported(t))
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunks.current = []
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data)
      rec.start()
      recorder.current = rec
      setSeconds(0)
      timer.current = window.setInterval(() => setSeconds((s) => s + 1), 1000)
      setState('recording')
    } catch {
      setState('denied')
    }
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
    if (recorder.current) recorder.current.onstop = null
    recorder.current?.state === 'recording' && recorder.current.stop()
    cleanup()
    setState('idle')
  }, [cleanup])

  return { state, seconds, start, stop, cancel }
}

export const formatSeconds = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
