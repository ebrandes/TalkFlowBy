import { FileCode2, FolderOpen, Pin, PinOff, RefreshCw, Sparkles, Trash2, UserPen } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { noteFromLink } from '../lib/answer'
import { joinFrontmatter, parseMeetingName, splitFrontmatter, summaryPreview } from '../lib/notes'
import { dropPending, flush, scheduleSave } from '../lib/saver'
import { ConfirmDialog } from './ConfirmDialog'
import { NameDialog } from './NameDialog'
import { othersLabels, renameSpeakers } from '../../../shared/speakers'
import type { Settings } from '../../../shared/types'
import { Editor } from './Editor'
import { FindBar } from './FindBar'
import { ShareMenu } from './ShareMenu'
import { Stamp } from './Stamp'

interface Props {
  path: string
  /** Recebe a chave para desfazer a ida para a Lixeira. */
  onDeleted: (undoId: string | null) => void
  pinned: boolean
  onPinned: (s: Settings) => void
  onPreview: (text: string) => void
  onToast: (message: string, action?: { label: string; run: () => void }) => void
  /** Abre a pesquisa inteligente sobre esta nota. */
  onAsk: () => void
  /** Abre outra nota (link para um .md dentro da pasta). */
  onOpenNote: (path: string) => void
}

/** Abre uma nota: carimbo (se for reunião) e o editor com salvamento automático. */
export function NoteView({ path, onDeleted, onPreview, onToast, pinned, onPinned, onAsk, onOpenNote }: Props): React.JSX.Element {
  const t = useT()
  const [loaded, setLoaded] = useState<{ path: string; front: string; body: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [confirming, setConfirming] = useState(false)
  /** Muda quando o conteúdo vem de fora do editor (resumo novo, edição em outro app); recria o editor. */
  const [revision, setRevision] = useState(0)
  const [summarizing, setSummarizing] = useState(false)
  const [naming, setNaming] = useState(false)
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

  const replaceContent = (md: string): void => {
    const { front, body } = splitFrontmatter(md)
    setLoaded({ path, front, body })
    setBody(body)
    setRevision((r) => r + 1)
    onPreview(summaryPreview(body))
  }

  // Editada no Obsidian, no Explorer ou pela sincronização: mostra a versão do disco.
  useEffect(
    () =>
      window.talkflow.library.onNoteChangedOutside((p) => {
        if (p.path !== path) return
        dropPending(path)
        void window.talkflow.library.read(path).then((md) => {
          replaceContent(md)
          if (!p.quiet) onToast(t.note.changedOutside)
        })
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path]
  )

  const renameSpeaker = (names: Record<string, string>): void => {
    setNaming(false)
    if (!loaded) return
    const next = renameSpeakers(body, names)
    if (next === body) return
    const md = joinFrontmatter(loaded.front, next)
    scheduleSave(path, md)
    replaceContent(md)
  }

  const resummarize = async (): Promise<void> => {
    setSummarizing(true)
    await flush()
    const res = await window.talkflow.library.resummarize(path)
    setSummarizing(false)
    if (res.ok) {
      replaceContent(res.markdown)
      onToast(t.note.resummarized)
    } else onToast(res.error)
  }

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
  const voices = othersLabels(body)
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
            {meeting && (
              <button
                className={`icon-btn${noSummary ? ' attention' : ''}`}
                title={summarizing ? t.note.resummarizing : t.note.resummarize}
                aria-label={summarizing ? t.note.resummarizing : t.note.resummarize}
                aria-busy={summarizing}
                disabled={summarizing}
                onClick={() => void resummarize()}
              >
                <RefreshCw size={17} strokeWidth={1.75} className={summarizing ? 'spin' : undefined} />
              </button>
            )}
            {meeting && voices.length > 0 && (
              <button className="icon-btn" title={t.note.renameSpeaker} aria-label={t.note.renameSpeaker} onClick={() => setNaming(true)}>
                <UserPen size={17} strokeWidth={1.75} />
              </button>
            )}
            <button
              className={`icon-btn${pinned ? ' active' : ''}`}
              title={pinned ? t.note.unpin : t.note.pin}
              aria-label={pinned ? t.note.unpin : t.note.pin}
              aria-pressed={pinned}
              onClick={() => void window.talkflow.library.setPinned(path, !pinned).then(onPinned)}
            >
              {pinned ? <PinOff size={17} strokeWidth={1.75} /> : <Pin size={17} strokeWidth={1.75} />}
            </button>
            <button className="icon-btn" title={t.note.copyMarkdown} aria-label={t.note.copyMarkdown} onClick={() => void copyMarkdown()}>
              <FileCode2 size={17} strokeWidth={1.75} />
            </button>
            <button
              className="icon-btn"
              title={`${t.ask.openNote} (${t.ask.shortcut(window.talkflow.platform === 'darwin' ? '⌘' : 'Ctrl')})`}
              aria-label={t.ask.openNote}
              onClick={onAsk}
            >
              <Sparkles size={17} strokeWidth={1.75} />
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
        <div
          ref={editorBox}
          onClickCapture={(e) => {
            // Link para outra nota (como os da resposta salva) abre a nota no app.
            const a = (e.target as HTMLElement).closest('a')
            const target = a && noteFromLink(path, a.getAttribute('href') ?? '')
            if (!target) return
            e.preventDefault()
            e.stopPropagation()
            void flush().then(() => onOpenNote(target))
          }}
        >
          <Editor key={revision} docKey={path} value={loaded.body} onChange={onChange} />
        </div>
        <ConfirmDialog
          open={confirming}
          title={t.confirm.trashOne}
          detail={meeting?.subject ?? name}
          onCancel={() => setConfirming(false)}
          onConfirm={async () => {
            setConfirming(false)
            await flush()
            onDeleted(await window.talkflow.library.trash(path))
          }}
        />
        <NameDialog
          open={naming}
          title={voices.length > 1 ? t.note.renameVoicesTitle : t.note.renameSpeakerTitle}
          hint={voices.length > 1 ? t.note.renameVoicesHint : t.note.renameSpeakerHint}
          fields={voices}
          placeholder={t.note.renameSpeakerPlaceholder}
          apply={t.note.renameSpeakerApply}
          onApply={renameSpeaker}
          onCancel={() => setNaming(false)}
        />
      </div>
    </div>
  )
}
