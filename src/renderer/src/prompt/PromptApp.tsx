import { Circle, X } from 'lucide-react'
import { dict, langFromLocale, type Lang } from '../../../shared/i18n'

const params = new URLSearchParams(location.search)
const appName = params.get('name') ?? 'Teams'
const t = dict((params.get('lang') as Lang | null) ?? langFromLocale(navigator.language)).prompt

/** Aviso pequeno no canto: uma pergunta, dois botões, e o "nunca" num link discreto. */
export function PromptApp(): React.JSX.Element {
  const answer = (a: 'record' | 'later' | 'never'): void => void window.talkflow.prompt.answer(a)
  return (
    <div className={`prompt platform-${window.talkflow.platform}`} role="alertdialog" aria-labelledby="prompt-title" aria-describedby="prompt-desc">
      <div className="prompt-head">
        <h1 id="prompt-title">{t.title}</h1>
        <button className="icon-btn small" onClick={() => answer('later')} aria-label={t.close}>
          <X size={15} strokeWidth={1.75} />
        </button>
      </div>
      <p id="prompt-desc">{t.desc(appName)}</p>
      <div className="prompt-actions">
        <button className="btn ghost" onClick={() => answer('never')} title={t.neverTitle}>
          {t.never}
        </button>
        <span className="prompt-main">
          <button className="btn" onClick={() => answer('later')}>
            {t.later}
          </button>
          <button className="btn primary" onClick={() => answer('record')} autoFocus>
            <Circle size={12} strokeWidth={2} fill="currentColor" aria-hidden />
            {t.record}
          </button>
        </span>
      </div>
    </div>
  )
}
