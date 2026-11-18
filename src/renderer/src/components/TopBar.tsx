import { AlertTriangle, Circle, Square } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { PipelineStatus } from '../../../shared/types'
import type { RecordingView } from '../hooks/useRecording'
import { Stamp } from './Stamp'

/** As mesmas palavras do carimbo da nota: gravando → transcrevendo → resumindo → resumido. */
const LABELS: Partial<Record<PipelineStatus['stage'], string>> = {
  converting: 'Transcrevendo',
  transcribing: 'Transcrevendo',
  summarizing: 'Resumindo',
  saving: 'Resumindo',
  done: 'Resumido'
}

export function clock(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${String(h).padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`
}

interface Props {
  crumbs: React.ReactNode
  rec: RecordingView
  status: PipelineStatus
  /** Motivo para não poder gravar ainda; vazio quando está tudo pronto. */
  blockedReason: string | null
}

export function TopBar({ crumbs, rec, status, blockedReason }: Props): React.JSX.Element {
  return (
    <header className="bar">
      {crumbs}
      <div className="bar-right">
        <PipelineChip status={status} />
        {rec.warning && (
          <span className="bar-warning" title={rec.warning}>
            <AlertTriangle size={15} strokeWidth={1.75} aria-hidden />
            {rec.warning}
          </span>
        )}
        {rec.recording ? (
          <>
            <Stamp live parts={[clock(rec.elapsed)]} state="Gravando" />
            <button className="btn danger" onClick={() => void rec.stop()} disabled={rec.busy}>
              <Square size={14} strokeWidth={2} fill="currentColor" aria-hidden />
              Parar
            </button>
          </>
        ) : (
          <>
            {blockedReason && <span className="bar-hint">{blockedReason}</span>}
            <button className="btn primary" onClick={() => void rec.start()} disabled={rec.busy || Boolean(blockedReason)}>
              <Circle size={13} strokeWidth={2} fill="currentColor" aria-hidden />
              {rec.busy ? 'Iniciando…' : 'Gravar'}
            </button>
          </>
        )}
      </div>
    </header>
  )
}

/** Andamento do processamento como carimbo, com o horário da gravação; o estado troca no lugar. */
function PipelineChip({ status }: { status: PipelineStatus }): React.JSX.Element | null {
  const [hideDone, setHideDone] = useState(false)
  useEffect(() => {
    setHideDone(false)
    if (status.stage !== 'done') return
    const t = setTimeout(() => setHideDone(true), status.message ? 12_000 : 4_000)
    return () => clearTimeout(t)
  }, [status])

  if (status.stage === 'error') {
    return (
      <span className="bar-warning error" title={status.message}>
        <AlertTriangle size={15} strokeWidth={1.75} aria-hidden />
        {status.message ?? 'Algo deu errado ao processar a gravação.'}
      </span>
    )
  }
  if (status.stage === 'done' && status.message && !hideDone) {
    return (
      <span className="bar-warning" title={status.message}>
        <AlertTriangle size={15} strokeWidth={1.75} aria-hidden />
        Gravação de {status.meeting} salva sem resumo
      </span>
    )
  }
  const label = LABELS[status.stage]
  if (!label || (status.stage === 'done' && hideDone)) return null
  const pct = status.stage === 'transcribing' && status.progress !== undefined ? `${Math.round(status.progress * 100)}%` : undefined
  return <Stamp parts={[status.meeting ? `Gravação ${status.meeting}` : undefined, pct]} state={label} />
}
