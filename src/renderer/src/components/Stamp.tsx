interface Props {
  /** Partes do carimbo: data, hora, duração, origem. Vazias são omitidas. */
  parts: (string | undefined)[]
  /** Palavra de estado no selo invertido: Gravando, Transcrevendo, Resumido… */
  state?: string
  live?: boolean
}

/** O carimbo datador: assinatura visual do app. Violeta só aparece aqui e em estados. */
export function Stamp({ parts, state, live }: Props): React.JSX.Element {
  const text = parts.filter(Boolean).join(' · ')
  return (
    <span className={`stamp${live ? ' live' : ''}`} role="status">
      {text && <span className="stamp-text">{text}</span>}
      {state && (
        <span className="stamp-state" key={state}>
          {state}
        </span>
      )}
    </span>
  )
}

interface DateBlockProps {
  month: string
  day: number
  selected?: boolean
}

/** Pequeno carimbo de data das linhas da lista. */
export function DateBlock({ month, day, selected }: DateBlockProps): React.JSX.Element {
  return (
    <span className={`date-block${selected ? ' selected' : ''}`} aria-hidden>
      <span className="date-month">{month}</span>
      <span className="date-day">{String(day).padStart(2, '0')}</span>
    </span>
  )
}
