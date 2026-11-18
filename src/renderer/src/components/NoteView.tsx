import { FolderOpen, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { MONTHS, joinFrontmatter, parseMeetingName, splitFrontmatter, summaryPreview } from '../lib/notes'
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
      .catch(() => alive && setError('Não foi possível abrir esta nota. Ela pode ter sido movida ou apagada.'))
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
  const noSummary = loaded.body.includes('O resumo não foi gerado')
  const onChange = (markdown: string): void => scheduleSave(loaded.path, joinFrontmatter(loaded.front, markdown))

  return (
    <div className="doc">
      <div className="doc-col">
        <div className="doc-head">
          {meeting ? (
            <Stamp
              parts={[`${meeting.day} ${MONTHS[meeting.month - 1]} ${meeting.year}`, meeting.time, meta.duracao, meta.origem]}
              state={noSummary ? 'Sem resumo' : 'Resumido'}
            />
          ) : (
            <span />
          )}
          <div className="doc-tools">
            <button
              className="icon-btn"
              title="Mostrar o arquivo na pasta"
              aria-label="Mostrar o arquivo na pasta"
              onClick={() => void window.talkflow.library.reveal(path)}
            >
              <FolderOpen size={17} strokeWidth={1.75} />
            </button>
            <button
              className="icon-btn"
              title="Mover para a Lixeira"
              aria-label="Mover para a Lixeira"
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
