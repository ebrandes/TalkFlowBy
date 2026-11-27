import { Square, SquareCheck } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { LibraryNode, OpenTask } from '../../../shared/types'
import { useT } from '../i18n'
import { parseMeetingName } from '../lib/notes'

interface Props {
  tree: LibraryNode[]
  query: string
  selected: string | null
  onOpen: (path: string) => void
}

const key = (t: OpenTask): string => `${t.path}#${t.line}`

/** Pendências abertas de todas as notas, agrupadas pela nota; marcar risca o item no arquivo. */
export function TaskList({ tree, query, selected, onOpen }: Props): React.JSX.Element {
  const t = useT()
  const [tasks, setTasks] = useState<OpenTask[] | null>(null)
  const [done, setDone] = useState<Set<string>>(new Set())
  const refresh = useCallback(() => void window.talkflow.library.tasks().then(setTasks), [])

  // A árvore muda quando uma nota é salva, criada ou apagada: recarrega a lista.
  useEffect(refresh, [refresh, tree])

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const by = new Map<string, OpenTask[]>()
    for (const task of tasks ?? []) {
      if (q && !task.text.toLowerCase().includes(q)) continue
      by.set(task.path, [...(by.get(task.path) ?? []), task])
    }
    return [...by.entries()]
  }, [tasks, query])

  const toggle = async (task: OpenTask): Promise<void> => {
    const on = !done.has(key(task))
    if (!(await window.talkflow.library.setTask(task, on))) return refresh()
    setDone((prev) => {
      const next = new Set(prev)
      if (on) next.add(key(task))
      else next.delete(key(task))
      return next
    })
  }

  if (tasks && groups.length === 0) return <p className="list-empty">{query ? t.rail.nothingFound(query) : t.rail.emptyTasks}</p>

  return (
    <>
      {groups.map(([path, items]) => {
        const name = path.split('/').pop()!.replace(/\.md$/i, '')
        const meeting = parseMeetingName(name)
        const title = meeting ? `${meeting.day} ${t.months[meeting.month - 1]} · ${meeting.subject}` : name
        return (
          <section key={path} className="task-group">
            <button className={`list-month task-note${path === selected ? ' selected' : ''}`} onClick={() => onOpen(path)}>
              {title}
            </button>
            {items.map((task) => {
              const on = done.has(key(task))
              return (
                <button key={key(task)} className={`row task-row${on ? ' done' : ''}`} onClick={() => void toggle(task)} aria-pressed={on}>
                  {on ? <SquareCheck size={16} strokeWidth={1.75} aria-hidden /> : <Square size={16} strokeWidth={1.75} aria-hidden />}
                  <span className="row-body">
                    <span className="row-title">{task.text}</span>
                  </span>
                </button>
              )
            })}
          </section>
        )
      })}
    </>
  )
}
