import { Copy, FileText, MessageSquare, Send } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { claudeUrl, transcriptOf } from '../lib/share'

interface Props {
  /** Nota inteira em markdown (com o cabeçalho). */
  markdown: string
  /** Corpo sem o cabeçalho, para achar a transcrição. */
  body: string
  onToast: (message: string) => void
}

/** Botão Enviar: copiar a nota, copiar só a transcrição, ou abrir no Claude. */
export function ShareMenu({ markdown, body, onToast }: Props): React.JSX.Element {
  const t = useT().note
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const transcript = transcriptOf(body)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent): void => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  const copy = async (text: string, message: string): Promise<void> => {
    await navigator.clipboard.writeText(text)
    setOpen(false)
    onToast(message)
  }

  const openClaude = async (): Promise<void> => {
    await navigator.clipboard.writeText(markdown)
    setOpen(false)
    window.open(claudeUrl(markdown))
    onToast(t.copiedForClaude)
  }

  return (
    <div className="share" ref={wrap}>
      <button className="icon-btn" aria-label={t.share} title={t.share} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Send size={17} strokeWidth={1.75} />
      </button>
      {open && (
        <div className="menu" role="menu">
          <button role="menuitem" className="menu-item" onClick={() => void openClaude()}>
            <MessageSquare size={16} strokeWidth={1.75} aria-hidden />
            {t.openClaude}
          </button>
          <button role="menuitem" className="menu-item" onClick={() => void copy(markdown, t.copied)}>
            <Copy size={16} strokeWidth={1.75} aria-hidden />
            {t.copyNote}
          </button>
          <button
            role="menuitem"
            className="menu-item"
            disabled={!transcript}
            title={transcript ? undefined : t.noTranscript}
            onClick={() => void copy(transcript, t.copied)}
          >
            <FileText size={16} strokeWidth={1.75} aria-hidden />
            {t.copyTranscript}
          </button>
        </div>
      )}
    </div>
  )
}
