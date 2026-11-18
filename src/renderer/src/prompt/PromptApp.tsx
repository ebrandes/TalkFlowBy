import { Circle, X } from 'lucide-react'

const params = new URLSearchParams(location.search)
const appName = params.get('name') ?? 'uma reunião'

/** Aviso pequeno no canto: uma pergunta, dois botões, e o "nunca" num link discreto. */
export function PromptApp(): React.JSX.Element {
  const answer = (a: 'record' | 'later' | 'never'): void => void window.talkflow.prompt.answer(a)
  return (
    <div className={`prompt platform-${window.talkflow.platform}`} role="alertdialog" aria-labelledby="prompt-title" aria-describedby="prompt-desc">
      <div className="prompt-head">
        <h1 id="prompt-title">Gravar esta reunião?</h1>
        <button className="icon-btn small" onClick={() => answer('later')} aria-label="Fechar aviso">
          <X size={15} strokeWidth={1.75} />
        </button>
      </div>
      <p id="prompt-desc">Reunião no {appName}. Lembre de avisar os participantes.</p>
      <div className="prompt-actions">
        <button className="btn ghost" onClick={() => answer('never')} title="Não perguntar mais para este app">
          Nunca para este app
        </button>
        <span className="prompt-main">
          <button className="btn" onClick={() => answer('later')}>
            Agora não
          </button>
          <button className="btn primary" onClick={() => answer('record')} autoFocus>
            <Circle size={12} strokeWidth={2} fill="currentColor" aria-hidden />
            Gravar
          </button>
        </span>
      </div>
    </div>
  )
}
