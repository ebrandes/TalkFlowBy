import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'

interface Props {
  open: boolean
  title: string
  hint: string
  placeholder: string
  apply: string
  /** Um campo por rótulo; com um só, a caixa mostra só o campo. */
  fields: string[]
  onApply: (values: Record<string, string>) => void
  onCancel: () => void
}

/** Caixa com campos de texto (por exemplo, o nome de cada voz). Esc ou fora da caixa cancela. */
export function NameDialog({ open, title, hint, placeholder, apply, fields, onApply, onCancel }: Props): React.JSX.Element {
  const t = useT().confirm
  const ref = useRef<HTMLDialogElement>(null)
  const [values, setValues] = useState<Record<string, string>>({})

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      setValues({})
      d.showModal()
    }
    if (!open && d.open) d.close()
  }, [open])

  const filled = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v))
  const submit = (): void => {
    if (Object.keys(filled).length) onApply(filled)
  }
  const many = fields.length > 1

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
        <div className={many ? 'name-fields' : undefined}>
          {fields.map((f, i) => (
            <label key={f} className={many ? 'name-row' : undefined}>
              {many && <span>{f}</span>}
              <input
                className="field"
                autoFocus={i === 0}
                placeholder={placeholder}
                value={values[f] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [f]: e.target.value }))}
                aria-label={many ? f : placeholder}
              />
            </label>
          ))}
        </div>
        <div className="confirm-actions">
          <button type="button" className="btn" onClick={onCancel}>
            {t.cancel}
          </button>
          <button type="submit" className="btn primary" disabled={!Object.keys(filled).length}>
            {apply}
          </button>
        </div>
      </form>
    </dialog>
  )
}
