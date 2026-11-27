import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dict } from '../../../shared/i18n'
import { elapsedSec, IDLE, type RecordingState, type StartCommand } from '../../../shared/recording'
import { recorder } from '../recorder'

/** Som mais recente que isso indica que a chamada continua. */
const STILL_TALKING_MS = 20_000
/**
 * Gravação que começou sozinha: quem decide o fim é a detecção da reunião. O silêncio só para
 * depois de bem mais tempo (sala de espera, todo mundo mudo), para não cortar a reunião no meio.
 */
const AUTO_SILENCE_MIN_MINUTES = 20

export interface RecordingView {
  recording: boolean
  paused: boolean
  startedAt: Date | null
  origin: string | null
  elapsed: number
  busy: boolean
  warning: string | null
  start: (origin?: string, cmd?: StartCommand) => Promise<void>
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

  const start = useCallback(async (from?: string, cmd: StartCommand = {}) => {
    if (busyRef.current || recorder.active) return
    busyRef.current = true
    setBusy(true)
    setWarning(null)
    const minutes = cmd.auto && silenceMinutes > 0 ? Math.max(silenceMinutes, AUTO_SILENCE_MIN_MINUTES) : silenceMinutes
    try {
      const { systemAudio } = await recorder.start(
        from,
        {
          silenceMinutes: minutes,
          onSilence: () => {
            void stopRef.current().then(() => window.talkflow.recording.autoStopped({ reason: 'silence', minutes }))
          }
        },
        { title: cmd.title, auto: cmd.auto, appId: cmd.appId }
      )
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
      api.onStartCommand((p) => {
        // Outra reunião começou: fecha a gravação atual (vira uma nota) e abre a nova.
        if (p.restart && recorder.active) return void stopRef.current().then(() => start(p.origin, p))
        void start(p.origin, p)
      }),
      api.onPauseCommand(() => void pause()),
      api.onResumeCommand(() => void resume()),
      api.onStopCommand((p) => {
        if (p.reason !== 'meeting-ended') return void stop()
        if (!recorder.active) return
        // Em pausa o medidor de som não conta: a chamada acabou, encerra. Idem depois de minutos conferindo.
        if (recorder.paused || p.force) return void stop().then(() => window.talkflow.recording.autoStopped({ reason: 'meeting', app: p.app ?? '' }))
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
