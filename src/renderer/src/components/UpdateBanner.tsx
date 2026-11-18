import { ArrowDownToLine, RotateCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useT } from '../i18n'

type Info = { version: string; state: 'available' | 'ready' }

/** Aviso discreto no pé da lista quando há versão nova. */
export function UpdateBanner(): React.JSX.Element | null {
  const t = useT().update
  const [info, setInfo] = useState<Info | null>(null)

  useEffect(() => {
    void window.talkflow.update.get().then(setInfo)
    return window.talkflow.update.onInfo(setInfo)
  }, [])

  if (!info) return null
  const ready = info.state === 'ready'
  return (
    <div className="update" role="status">
      <span className="update-text">{ready ? t.ready(info.version) : t.available(info.version)}</span>
      <button className="btn" onClick={() => void window.talkflow.update.apply()}>
        {ready ? <RotateCw size={14} strokeWidth={1.75} aria-hidden /> : <ArrowDownToLine size={14} strokeWidth={1.75} aria-hidden />}
        {ready ? t.restart : t.download}
      </button>
    </div>
  )
}
