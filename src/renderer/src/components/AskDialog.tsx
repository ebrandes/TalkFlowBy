import { Copy, FileText, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { AskResult } from '../../../shared/types'
import { useT } from '../i18n'
import { noteTitle, parseBlocks, parseInline, toMarkdown, type Inline } from '../lib/answer'

export type AskScope = 'note' | 'all'

interface Props {
  open: boolean
  /** Nota aberta agora; sem ela, só dá para perguntar sobre todas. */
  notePath: string | null
  scope: AskScope
  onScope: (s: AskScope) => void
  onClose: () => void
  onOpenNote: (path: string) => void
  onToast: (message: string) => void
}

type State = { kind: 'idle' } | { kind: 'loading' } | { kind: 'done'; result: AskResult; question: string } | { kind: 'error'; message: string }

/** Pesquisa inteligente: pergunta em linguagem natural, respondida pelo Haiku a partir das notas. */
export function AskDialog(p: Props): React.JSX.Element {
  const t = useT().ask
  const ref = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const [question, setQuestion] = useState('')
  const [state, setState] = useState<State>({ kind: 'idle' })
  const run = useRef(0)
  const scope: AskScope = p.notePath ? p.scope : 'all'

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (p.open && !d.open) {
      d.showModal()
      requestAnimationFrame(() => input.current?.select())
    }
    if (!p.open && d.open) d.close()
  }, [p.open])

  // Trocar de nota ou de escopo apaga a resposta antiga, que falava de outra coisa.
  useEffect(() => {
    run.current++
    setState({ kind: 'idle' })
  }, [scope, p.notePath])

  const ask = async (q = question): Promise<void> => {
    if (!q.trim() || state.kind === 'loading') return
    setQuestion(q)
    const id = ++run.current
    setState({ kind: 'loading' })
    try {
      const result = await window.talkflow.ai.ask(q, scope === 'note' ? p.notePath : null)
      if (id === run.current) setState({ kind: 'done', result, question: q })
    } catch (err) {
      const message = (err as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
      if (id === run.current) setState({ kind: 'error', message })
    }
  }

  const copy = async (): Promise<void> => {
    if (state.kind !== 'done') return
    await navigator.clipboard.writeText(toMarkdown(state.result))
    p.onToast(t.copied)
  }

  const examples = scope === 'note' ? t.examples.note : t.examples.all

  return (
    <dialog
      ref={ref}
      className="ask"
      aria-labelledby="ask-title"
      onCancel={(e) => {
        e.preventDefault()
        p.onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) p.onClose()
      }}
    >
      <div className="ask-head">
        <h2 id="ask-title">
          <Sparkles size={17} strokeWidth={1.75} aria-hidden />
          {t.title}
        </h2>
        <div className="segmented ask-scope" role="radiogroup">
          <button role="radio" aria-checked={scope === 'note'} disabled={!p.notePath} onClick={() => p.onScope('note')}>
            {t.scopeNote}
          </button>
          <button role="radio" aria-checked={scope === 'all'} onClick={() => p.onScope('all')}>
            {t.scopeAll}
          </button>
        </div>
        <button className="icon-btn" onClick={p.onClose} aria-label={t.close} title={t.close}>
          <X size={17} strokeWidth={1.75} />
        </button>
      </div>

      <form
        className="ask-form"
        onSubmit={(e) => {
          e.preventDefault()
          void ask()
        }}
      >
        <textarea
          ref={input}
          className="ask-input"
          rows={2}
          value={question}
          placeholder={t.placeholder}
          aria-label={t.title}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              void ask()
            }
          }}
        />
        <button className="btn primary" type="submit" disabled={!question.trim() || state.kind === 'loading'}>
          {t.submit}
        </button>
      </form>

      <div className="ask-body" aria-live="polite">
        {state.kind === 'idle' && (
          <ul className="ask-examples">
            {examples.map((ex) => (
              <li key={ex}>
                <button className="ask-example" onClick={() => void ask(ex)}>
                  {ex}
                </button>
              </li>
            ))}
          </ul>
        )}
        {state.kind === 'loading' && <p className="ask-status">{t.thinking}</p>}
        {state.kind === 'error' && (
          <div className="ask-error">
            <p>
              <strong>{t.failed}</strong> {state.message}
            </p>
            <p className="ask-hint">{t.setupHint}</p>
          </div>
        )}
        {state.kind === 'done' && (
          <>
            <Answer result={state.result} onOpenNote={p.onOpenNote} />
            {(state.result.omitted > 0 || state.result.trimmed > 0) && <p className="ask-hint">{t.partial(state.result.omitted, state.result.trimmed)}</p>}
            <div className="ask-foot">
              <Sources result={state.result} onOpenNote={p.onOpenNote} />
              <button className="btn ghost" onClick={() => void copy()}>
                <Copy size={14} strokeWidth={1.75} aria-hidden />
                {t.copy}
              </button>
            </div>
          </>
        )}
      </div>
    </dialog>
  )
}

function Answer({ result, onOpenNote }: { result: AskResult; onOpenNote: (path: string) => void }): React.JSX.Element {
  const inline = (text: string): React.ReactNode => <InlineText parts={parseInline(text)} notes={result.notes} onOpenNote={onOpenNote} />
  return (
    <div className="ask-answer">
      {parseBlocks(result.answer).map((b, i) => {
        if (b.kind === 'heading') return <h3 key={i}>{inline(b.text)}</h3>
        if (b.kind === 'code') return <pre key={i}>{b.text}</pre>
        if (b.kind === 'list') {
          const items = b.items.map((it, j) => <li key={j}>{inline(it)}</li>)
          return b.ordered ? <ol key={i}>{items}</ol> : <ul key={i}>{items}</ul>
        }
        return <p key={i}>{inline(b.text)}</p>
      })}
    </div>
  )
}

function InlineText({ parts, notes, onOpenNote }: { parts: Inline[]; notes: string[]; onOpenNote: (path: string) => void }): React.JSX.Element {
  return (
    <>
      {parts.map((x, i) => {
        if (x.kind === 'strong') return <strong key={i}>{x.text}</strong>
        if (x.kind === 'em') return <em key={i}>{x.text}</em>
        if (x.kind === 'code') return <code key={i}>{x.text}</code>
        if (x.kind === 'link')
          return (
            <a key={i} href={x.href} target="_blank" rel="noreferrer">
              {x.text}
            </a>
          )
        if (x.kind === 'cite') {
          const path = notes[x.id - 1]
          if (!path) return <span key={i}>[{x.id}]</span>
          return (
            <button key={i} className="ask-cite" title={noteTitle(path)} onClick={() => onOpenNote(path)}>
              {x.id}
            </button>
          )
        }
        return <span key={i}>{x.text}</span>
      })}
    </>
  )
}

function Sources({ result, onOpenNote }: { result: AskResult; onOpenNote: (path: string) => void }): React.JSX.Element {
  const t = useT().ask
  // Uma nota só (escopo "esta nota") não precisa de lista de fontes.
  if (result.notes.length === 1) return <span />
  if (result.sources.length === 0) return <p className="ask-hint">{t.noSources}</p>
  return (
    <div className="ask-sources">
      <span className="ask-sources-label">{t.sources}</span>
      {result.sources.map((path) => (
        <button key={path} className="ask-source" onClick={() => onOpenNote(path)}>
          <span className="ask-source-id">{result.notes.indexOf(path) + 1}</span>
          <FileText size={14} strokeWidth={1.75} aria-hidden />
          {noteTitle(path)}
        </button>
      ))}
    </div>
  )
}
