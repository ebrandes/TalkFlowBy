import { FileCode2, FolderOpen, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { joinFrontmatter, parseMeetingName, splitFrontmatter, summaryPreview } from '../lib/notes'
import { flush, scheduleSave } from '../lib/saver'
import { ConfirmDialog } from './ConfirmDialog'
import { Editor } from './Editor'
import { FindBar } from './FindBar'
import { ShareMenu } from './ShareMenu'
import { Stamp } from './Stamp'

interface Props {
  path: string
  onDeleted: () => void
  onPreview: (text: string) => void
  onToast: (message: string) => void
}

/** Abre uma nota: carimbo (se for reunião) e o editor com salvamento automático. */
export function NoteView({ path, onDeleted, onPreview, onToast }: Props): React.JSX.Element {
  const t = useT()
  const [loaded, setLoaded] = useState<{ path: string; front: string; body: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [finding, setFinding] = useState(false)
  const editorBox = useRef<HTMLDivElement>(null)
  const markdownRef = useRef('')

  const name = path.split('/').pop()!.replace(/\.md$/i, '')
  const meeting = parseMeetingName(name)

  useEffect(() => {
    let alive = true
    setError(null)
    window.talkflow.library
      .read(path)
      .then((md) => {
        if (!alive) return
        const { front, body } = splitFrontmatter(md)
        setLoaded({ path, front, body })
        setBody(body)
        onPreview(summaryPreview(body))
      })
      .catch(() => alive && setError(t.note.openError))
    return () => {
      alive = false
      void flush()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])

  const copyMarkdown = async (): Promise<void> => {
    if (!markdownRef.current) return
    await navigator.clipboard.writeText(markdownRef.current)
    onToast(t.note.copiedMarkdown)
  }

  // Atalhos da nota: Ctrl+F / ⌘F abre a busca; Ctrl+Shift+C / ⌘⇧C copia o Markdown inteiro.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const mod = window.talkflow.platform === 'darwin' ? e.metaKey : e.ctrlKey
      if (!mod || e.altKey) return
      const key = e.key.toLowerCase()
      if (key === 'f' && !e.shiftKey) {
        e.preventDefault()
        setFinding(true)
        window.dispatchEvent(new Event('tfb-find-focus'))
      } else if (key === 'c' && e.shiftKey) {
        e.preventDefault()
        void copyMarkdown()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (error) {
    return (
      <div className="doc">
        <p className="doc-error">{error}</p>
      </div>
    )
  }
  if (!loaded || loaded.path !== path) return <div className="doc" aria-busy />

  const meta = splitFrontmatter(`${loaded.front}\n`).meta
  const noSummary = loaded.body.includes('O resumo não foi gerado') || loaded.body.includes('The summary was not generated')
  const fullMarkdown = joinFrontmatter(loaded.front, body)
  markdownRef.current = fullMarkdown
  const onChange = (markdown: string): void => {
    setBody(markdown)
    scheduleSave(loaded.path, joinFrontmatter(loaded.front, markdown))
  }

  return (
    <div className="doc">
      <div className="doc-col">
        {finding && <FindBar root={editorBox} onClose={() => setFinding(false)} />}
        <div className="doc-head">
          {meeting ? (
            <Stamp
              parts={[`${meeting.day} ${t.months[meeting.month - 1]} ${meeting.year}`, meeting.time, meta.duracao, meta.origem]}
              state={noSummary ? t.note.noSummary : t.note.summarized}
            />
          ) : (
            <span />
          )}
          <div className="doc-tools">
            <button className="icon-btn" title={t.note.copyMarkdown} aria-label={t.note.copyMarkdown} onClick={() => void copyMarkdown()}>
              <FileCode2 size={17} strokeWidth={1.75} />
            </button>
            <ShareMenu markdown={fullMarkdown} body={body} onToast={onToast} />
            <button
              className="icon-btn"
              title={t.note.reveal}
              aria-label={t.note.reveal}
              onClick={() => void window.talkflow.library.reveal(path)}
            >
              <FolderOpen size={17} strokeWidth={1.75} />
            </button>
            <button
              className="icon-btn"
              title={t.note.trash}
              aria-label={t.note.trash}
              onClick={() => setConfirming(true)}
            >
              <Trash2 size={17} strokeWidth={1.75} />
            </button>
          </div>
        </div>
        <div ref={editorBox}>
          <Editor docKey={path} value={loaded.body} onChange={onChange} />
        </div>
        <ConfirmDialog
          open={confirming}
          title={t.confirm.trashOne}
          detail={meeting?.subject ?? name}
          onCancel={() => setConfirming(false)}
          onConfirm={async () => {
            setConfirming(false)
            await flush()
            await window.talkflow.library.trash(path)
            onDeleted()
          }}
        />
      </div>
    </div>
  )
}
