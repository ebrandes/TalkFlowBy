import { FolderOpen, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { joinFrontmatter, parseMeetingName, splitFrontmatter, summaryPreview } from '../lib/notes'
import { flush, scheduleSave } from '../lib/saver'
import { Editor } from './Editor'
import { Stamp } from './Stamp'

interface Props {
  path: string
  onDeleted: () => void
  onPreview: (text: string) => void
}

/** Abre uma nota: carimbo (se for reunião) e o editor com salvamento automático. */
export function NoteView({ path, onDeleted, onPreview }: Props): React.JSX.Element {
  const t = useT()
  const [loaded, setLoaded] = useState<{ path: string; front: string; body: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

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
        onPreview(summaryPreview(body))
      })
      .catch(() => alive && setError(t.note.openError))
    return () => {
      alive = false
      void flush()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])

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
  const onChange = (markdown: string): void => scheduleSave(loaded.path, joinFrontmatter(loaded.front, markdown))

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
              onClick={async () => {
                await flush()
                await window.talkflow.library.trash(path)
                onDeleted()
              }}
            >
              <Trash2 size={17} strokeWidth={1.75} />
            </button>
          </div>
        </div>
        <Editor docKey={path} value={loaded.body} onChange={onChange} />
      </div>
    </div>
  )
}
