import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dict } from '../../../shared/i18n'
import { recorder } from '../recorder'

export interface RecordingView {
  recording: boolean
  startedAt: Date | null
  origin: string | null
  elapsed: number
  busy: boolean
  warning: string | null
  start: (origin?: string) => Promise<void>
  stop: () => Promise<void>
}

/** Liga o gravador às ordens que chegam da bandeja, do aviso de reunião e do botão. */
export function useRecording(t: Dict['recorder']): RecordingView {
  const [recording, setRecording] = useState(false)
  const [startedAt, setStartedAt] = useState<Date | null>(null)
  const [origin, setOrigin] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [busy, setBusy] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)
  const busyRef = useRef(false)

  const start = useCallback(async (from?: string) => {
    if (busyRef.current || recorder.active) return
    busyRef.current = true
    setBusy(true)
    setWarning(null)
    try {
      const { systemAudio } = await recorder.start(from)
      if (!systemAudio) setWarning(t.micOnly)
    } catch (err) {
      setWarning(t.failed((err as Error).message))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }, [t])

  const stop = useCallback(async () => {
    if (busyRef.current || !recorder.active) return
    busyRef.current = true
    setBusy(true)
    try {
      await recorder.stop()
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    const api = window.talkflow.recording
    void api.state().then((s) => {
      setRecording(s.recording)
      setStartedAt(s.startedAt ? new Date(s.startedAt) : null)
      setOrigin(s.origin)
    })
    const offs = [
      api.onState((s) => {
        setRecording(s.recording)
        setStartedAt(s.startedAt ? new Date(s.startedAt) : null)
        setOrigin(s.origin)
        if (!s.recording) setWarning(null)
      }),
      api.onStartCommand((p) => void start(p.origin)),
      api.onStopCommand(() => void stop())
    ]
    return () => offs.forEach((off) => off())
  }, [start, stop])

  useEffect(() => {
    if (!recording || !startedAt) return setElapsed(0)
    const tick = (): void => setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [recording, startedAt])

  return { recording, startedAt, origin, elapsed, busy, warning, start, stop }
}
