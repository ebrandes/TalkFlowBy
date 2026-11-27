import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'

interface Props {
  open: boolean
  title: string
  hint: string
  placeholder: string
  apply: string
  onApply: (value: string) => void
  onCancel: () => void
}

/** Caixa com um campo de texto (por exemplo, o nome de quem falou). Esc ou fora da caixa cancela. */
export function NameDialog({ open, title, hint, placeholder, apply, onApply, onCancel }: Props): React.JSX.Element {
  const t = useT().confirm
  const ref = useRef<HTMLDialogElement>(null)
  const [value, setValue] = useState('')

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      setValue('')
      d.showModal()
    }
    if (!open && d.open) d.close()
  }, [open])

  const submit = (): void => {
    if (value.trim()) onApply(value.trim())
  }

  return (
    <dialog
      ref={ref}
      className="confirm"
      aria-labelledby="name-title"
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onCancel()
      }}
    >
      <h2 id="name-title">{title}</h2>
      <p className="confirm-hint">{hint}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <input className="field" autoFocus placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)} aria-label={placeholder} />
        <div className="confirm-actions">
          <button type="button" className="btn" onClick={onCancel}>
            {t.cancel}
          </button>
          <button type="submit" className="btn primary" disabled={!value.trim()}>
            {apply}
          </button>
        </div>
      </form>
    </dialog>
  )
}
