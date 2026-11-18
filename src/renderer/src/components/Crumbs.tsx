import { useEffect, useState } from 'react'
import type { Folders } from '../../../shared/types'
import { useT } from '../i18n'
import { parseMeetingName } from '../lib/notes'
import { flush } from '../lib/saver'

interface Props {
  path: string | null
  folders: Folders
  fallback: string
  onRenamed: (newPath: string) => void
}

/** Caminho da nota no topo; o último trecho é o nome do arquivo e pode ser renomeado ali mesmo. */
export function Crumbs({ path, folders, fallback, onRenamed }: Props): React.JSX.Element {
  const t = useT()
  if (!path) return <span className="crumbs">{fallback}</span>
  const name = path.split('/').pop()!.replace(/\.md$/i, '')
  const meeting = parseMeetingName(name)
  const section = path.startsWith(folders.meetings)
    ? meeting
      ? `${t.rail.meetings} / ${t.monthsLong[meeting.month - 1]} ${meeting.year}`
      : t.rail.meetings
    : t.rail.notes

  const rename = async (title: string): Promise<void> => {
    await flush()
    const next = meeting ? `${meeting.prefix} - ${title}` : title
    const newPath = await window.talkflow.library.rename(path, next)
    if (newPath !== path) onRenamed(newPath)
  }

  return (
    <span className="crumbs">
      <span className="crumbs-section">{section} /</span>
      <NameField key={path} value={meeting?.subject ?? name} label={t.note.fileName} hint={t.note.rename} onCommit={(v) => void rename(v)} />
    </span>
  )
}

interface NameProps {
  value: string
  label: string
  hint: string
  onCommit: (v: string) => void
}

function NameField({ value, label, hint, onCommit }: NameProps): React.JSX.Element {
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
      aria-label={label}
      title={hint}
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
