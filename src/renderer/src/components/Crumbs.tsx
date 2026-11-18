import { useEffect, useState } from 'react'
import { MONTHS_LONG, parseMeetingName } from '../lib/notes'
import { flush } from '../lib/saver'

interface Props {
  path: string | null
  fallback: string
  onRenamed: (newPath: string) => void
}

/** Caminho da nota no topo; o último trecho é o nome do arquivo e pode ser renomeado ali mesmo. */
export function Crumbs({ path, fallback, onRenamed }: Props): React.JSX.Element {
  if (!path) return <span className="crumbs">{fallback}</span>
  const name = path.split('/').pop()!.replace(/\.md$/i, '')
  const meeting = parseMeetingName(name)
  const section = path.startsWith('Reuniões')
    ? meeting
      ? `Reuniões / ${MONTHS_LONG[meeting.month - 1]} ${meeting.year}`
      : 'Reuniões'
    : 'Notas'

  const rename = async (title: string): Promise<void> => {
    await flush()
    const next = meeting ? `${meeting.prefix} - ${title}` : title
    const newPath = await window.talkflow.library.rename(path, next)
    if (newPath !== path) onRenamed(newPath)
  }

  return (
    <span className="crumbs">
      <span className="crumbs-section">{section} /</span>
      <NameField key={path} value={meeting?.subject ?? name} onCommit={(v) => void rename(v)} />
    </span>
  )
}

function NameField({ value, onCommit }: { value: string; onCommit: (v: string) => void }): React.JSX.Element {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const commit = (): void => {
    const v = draft.trim()
    if (v && v !== value) onCommit(v)
    else setDraft(value)
  }
  return (
    <input
      className="name-field"
      value={draft}
      size={Math.max(8, Math.min(48, draft.length + 1))}
      aria-label="Nome do arquivo"
      title="Clique para renomear o arquivo"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          setDraft(value)
          const el = e.currentTarget
          requestAnimationFrame(() => el.blur())
        }
      }}
    />
  )
}
