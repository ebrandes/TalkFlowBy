import { useEffect, useRef } from 'react'
import { useT } from '../i18n'

interface Props {
  open: boolean
  title: string
  detail?: string
  onConfirm: () => void
  onCancel: () => void
}

/** Pergunta curta antes de mandar para a Lixeira. Esc ou fora da caixa cancela. */
export function ConfirmDialog({ open, title, detail, onConfirm, onCancel }: Props): React.JSX.Element {
  const t = useT().confirm
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="confirm"
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onCancel()
      }}
    >
      <h2 id="confirm-title">{title}</h2>
      {detail && <p className="confirm-detail">{detail}</p>}
      <p className="confirm-hint">{t.trashHint}</p>
      <div className="confirm-actions">
        <button className="btn" onClick={onCancel}>
          {t.cancel}
        </button>
        <button className="btn danger" onClick={onConfirm}>
          {t.trash}
        </button>
      </div>
    </dialog>
  )
}
