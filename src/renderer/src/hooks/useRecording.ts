import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dict } from '../../../shared/i18n'
import { elapsedSec, IDLE, type RecordingState } from '../../../shared/recording'
import { recorder } from '../recorder'

/** Som mais recente que isso indica que a chamada continua. */
const STILL_TALKING_MS = 20_000

export interface RecordingView {
  recording: boolean
  paused: boolean
  startedAt: Date | null
  origin: string | null
  elapsed: number
  busy: boolean
  warning: string | null
  start: (origin?: string) => Promise<void>
  stop: () => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
}

/** Liga o gravador às ordens que chegam da bandeja, do aviso de reunião e do botão. */
export function useRecording(t: Dict['recorder'], silenceMinutes: number): RecordingView {
  const [state, setState] = useState<RecordingState>(IDLE)
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
      const { systemAudio } = await recorder.start(from, {
        silenceMinutes,
        onSilence: () => {
          void stopRef.current().then(() => window.talkflow.recording.autoStopped({ reason: 'silence', minutes: silenceMinutes }))
        }
      })
      if (!systemAudio) setWarning(t.micOnly)
    } catch (err) {
      setWarning(t.failed((err as Error).message))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }, [t, silenceMinutes])

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

  const pause = useCallback(async () => {
    await recorder.pause()
  }, [])

  const resume = useCallback(async () => {
    await recorder.resume()
  }, [])

  const stopRef = useRef(stop)
  stopRef.current = stop

  useEffect(() => {
    const api = window.talkflow.recording
    void api.state().then(setState)
    const offs = [
      api.onState((s) => {
        setState(s)
        if (!s.recording) setWarning(null)
      }),
      api.onStartCommand((p) => void start(p.origin)),
      api.onPauseCommand(() => void pause()),
      api.onResumeCommand(() => void resume()),
      api.onStopCommand((p) => {
        if (p.reason !== 'meeting-ended') return void stop()
        // Em pausa o medidor de som não conta: a chamada acabou, encerra.
        if (recorder.paused) return void stop().then(() => window.talkflow.recording.autoStopped({ reason: 'meeting', app: p.app ?? '' }))
        // O app da chamada soltou o microfone; se ainda tem gente falando, não é o fim.
        if (recorder.msSinceSound() < STILL_TALKING_MS) return
        void stop().then(() => window.talkflow.recording.autoStopped({ reason: 'meeting', app: p.app ?? '' }))
      })
    ]
    return () => offs.forEach((off) => off())
  }, [start, stop, pause, resume])

  useEffect(() => {
    if (!state.recording) return setElapsed(0)
    const tick = (): void => setElapsed(elapsedSec(state))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [state])

  return {
    recording: state.recording,
    paused: state.paused,
    startedAt: state.startedAt ? new Date(state.startedAt) : null,
    origin: state.origin,
    elapsed,
    busy,
    warning,
    start,
    stop,
    pause,
    resume
  }
}
