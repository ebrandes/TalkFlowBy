import { FolderOpen, RefreshCw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { joinFrontmatter, parseMeetingName, splitFrontmatter, summaryPreview } from '../lib/notes'
import { dropPending, flush, scheduleSave } from '../lib/saver'
import { ConfirmDialog } from './ConfirmDialog'
import { Editor } from './Editor'
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
  /** Muda quando o conteúdo vem de fora do editor (resumo novo, edição em outro app); recria o editor. */
  const [revision, setRevision] = useState(0)
  const [summarizing, setSummarizing] = useState(false)

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
          onToast(t.note.changedOutside)
        })
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path]
  )

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
  const onChange = (markdown: string): void => {
    setBody(markdown)
    scheduleSave(loaded.path, joinFrontmatter(loaded.front, markdown))
  }

  return (
    <div className="doc">
      <div className="doc-col">
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
            <ShareMenu markdown={joinFrontmatter(loaded.front, body)} body={body} onToast={onToast} />
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
        <Editor key={revision} docKey={path} value={loaded.body} onChange={onChange} />
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
