import { Circle } from 'lucide-react'
import { dict, langFromLocale, type Lang } from '../../../shared/i18n'

const params = new URLSearchParams(location.search)
const appName = params.get('name') ?? 'Teams'
const t = dict((params.get('lang') as Lang | null) ?? langFromLocale(navigator.language)).prompt

/** Aviso pequeno no canto: uma pergunta e duas respostas, gravar ou fechar. */
export function PromptApp(): React.JSX.Element {
  const answer = (a: 'record' | 'later'): void => void window.talkflow.prompt.answer(a)
  return (
    <div className={`prompt platform-${window.talkflow.platform}`} role="alertdialog" aria-labelledby="prompt-title" aria-describedby="prompt-desc">
      <h1 id="prompt-title">{t.title}</h1>
      <p id="prompt-desc">{t.desc(appName)}</p>
      <div className="prompt-actions">
        <button className="btn" onClick={() => answer('later')}>
          {t.close}
        </button>
        <button className="btn primary" onClick={() => answer('record')} autoFocus>
          <Circle size={12} strokeWidth={2} fill="currentColor" aria-hidden />
          {t.record}
        </button>
      </div>
    </div>
  )
}
