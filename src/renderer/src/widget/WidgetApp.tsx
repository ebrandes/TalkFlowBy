import { GripVertical, Pause, Play, Square } from 'lucide-react'
import { useEffect, useState } from 'react'
import { dict, langFromLocale, type Lang } from '../../../shared/i18n'
import { elapsedSec, IDLE, type RecordingState } from '../../../shared/recording'
import { clock } from '../components/TopBar'

const params = new URLSearchParams(location.search)
const t = dict((params.get('lang') as Lang | null) ?? langFromLocale(navigator.language)).widget

/**
 * Pílula flutuante enquanto grava: ponto vermelho, tempo, pausar e encerrar.
 * Arrasta por qualquer parte que não seja botão; os botões ficam só nas pontas.
 */
export function WidgetApp(): React.JSX.Element {
  const [state, setState] = useState<RecordingState>(IDLE)
  const [elapsed, setElapsed] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const api = window.talkflow.recording
    void api.state().then(setState)
    return api.onState((s) => {
      setState(s)
      setBusy(false)
    })
  }, [])

  useEffect(() => {
    const tick = (): void => setElapsed(elapsedSec(state))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [state])

  const command = (cmd: 'pause' | 'resume' | 'stop'): void => {
    setBusy(true)
    void window.talkflow.widget.command(cmd)
  }

  const label = state.paused ? t.paused : t.recording
  return (
    <div className={`widget${state.paused ? ' paused' : ''} platform-${window.talkflow.platform}`} role="status" aria-label={`${label} ${clock(elapsed)}`}>
      <GripVertical className="widget-grip" size={14} strokeWidth={2} aria-hidden />
      <span className="widget-dot" aria-hidden />
      <span className="widget-time" title={t.move}>
        <span className="widget-state">{label}</span>
        <span className="widget-clock">{clock(elapsed)}</span>
      </span>
      <button
        className="widget-btn"
        onClick={() => command(state.paused ? 'resume' : 'pause')}
        disabled={busy || !state.recording}
        title={state.paused ? t.resume : t.pause}
        aria-label={state.paused ? t.resume : t.pause}
      >
        {state.paused ? <Play size={14} strokeWidth={2} fill="currentColor" /> : <Pause size={14} strokeWidth={2} fill="currentColor" />}
      </button>
      <button className="widget-btn stop" onClick={() => command('stop')} disabled={busy || !state.recording} title={t.stop} aria-label={t.stop}>
        <Square size={12} strokeWidth={2} fill="currentColor" />
      </button>
    </div>
  )
}
