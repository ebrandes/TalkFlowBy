import { AlertTriangle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { FailedRecording } from '../../../shared/types'
import { useT } from '../i18n'

/** Gravações que não viraram nota: o motivo, e os botões para tentar de novo ou descartar. */
export function FailedRecordings(): React.JSX.Element | null {
  const t = useT()
  const [items, setItems] = useState<FailedRecording[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const refresh = useCallback(() => void window.talkflow.failed.list().then(setItems), [])

  useEffect(() => {
    refresh()
    return window.talkflow.failed.onChanged(refresh)
  }, [refresh])

  if (items.length === 0) return null

  const act = async (id: string, fn: (id: string) => Promise<void>): Promise<void> => {
    setBusy(id)
    await fn(id)
    setBusy(null)
    refresh()
  }

  const when = (r: FailedRecording): string => {
    const d = new Date(r.startedAt)
    const date = `${d.getDate()} ${t.months[d.getMonth()]} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    return t.failed.when(date, Math.max(1, Math.round(r.durationSec / 60)))
  }

  return (
    <section className="setup failed" aria-label={t.failed.title(items.length)}>
      <h2>
        <AlertTriangle size={16} strokeWidth={1.75} aria-hidden /> {t.failed.title(items.length)}
      </h2>
      <p className="hint">{t.failed.lead}</p>
      {items.map((r) => (
        <div className="set-row" key={r.id}>
          <span className="set-label">
            <span>{when(r)}</span>
            <span className="hint">{r.error}</span>
          </span>
          <span className="row-actions">
            <button className="btn" disabled={busy === r.id} onClick={() => void act(r.id, window.talkflow.failed.retry)}>
              {t.failed.retry}
            </button>
            <button className="btn ghost" disabled={busy === r.id} onClick={() => void act(r.id, window.talkflow.failed.discard)}>
              {t.failed.discard}
            </button>
          </span>
        </div>
      ))}
    </section>
  )
}
