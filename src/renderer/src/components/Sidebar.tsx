import { FilePlus2, FileText, ListChecks, Pin, Search, Settings, Square, SquareCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { Folders, LibraryNode } from '../../../shared/types'
import { useT } from '../i18n'
import { guideSpan, meetingGroups, noteItems, type ListItem } from '../lib/notes'
import { DateBlock } from './Stamp'
import { TaskList } from './TaskList'
import { UpdateBanner } from './UpdateBanner'

export type Tab = 'meetings' | 'notes' | 'tasks'

interface Props {
  tree: LibraryNode[]
  folders: Folders
  tab: Tab
  onTab: (t: Tab) => void
  selected: string | null
  preview: string
  onSelect: (rel: string) => void
  onNewNote: () => void
  onSettings: () => void
  /** Pede confirmação e manda as notas marcadas para a Lixeira; devolve quando terminar. */
  onTrashMany: (paths: string[]) => Promise<boolean>
  /** Notas fixadas no topo da lista. */
  pinned: string[]
}

export function Sidebar(p: Props): React.JSX.Element {
  const t = useT()
  const [query, setQuery] = useState('')
  const [picking, setPicking] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  // Busca também dentro das notas, com um pequeno atraso para não ler os arquivos a cada tecla.
  const [hits, setHits] = useState<Map<string, string>>(new Map())
  useEffect(() => {
    if (query.trim().length < 2) return setHits(new Map())
    let alive = true
    const timer = setTimeout(async () => {
      const found = await window.talkflow.library.search(query)
      if (alive) setHits(new Map(found.map((h) => [h.path, h.snippet])))
    }, 250)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [query, p.tree])
  const inContent = useMemo(() => new Set(hits.keys()), [hits])
  const snippetFor = (item: ListItem): string | undefined =>
    query && !item.title.toLowerCase().includes(query.trim().toLowerCase()) ? hits.get(item.path) : undefined
  const pinnedSet = useMemo(() => new Set(p.pinned), [p.pinned])
  // Fixadas vão para um grupo no topo; as outras seguem por mês.
  const groups = useMemo(() => {
    const all = meetingGroups(p.tree, query, p.folders, t, inContent)
    const top = all.flatMap((g) => g.items).filter((i) => pinnedSet.has(i.path))
    const rest = all.map((g) => ({ ...g, items: g.items.filter((i) => !pinnedSet.has(i.path)) })).filter((g) => g.items.length)
    return top.length ? [{ label: t.rail.pinned, items: top }, ...rest] : rest
  }, [p.tree, query, p.folders, t, inContent, pinnedSet])
  const notes = useMemo(() => {
    const all = noteItems(p.tree, query, p.folders, inContent)
    return [...all.filter((i) => pinnedSet.has(i.path)), ...all.filter((i) => !pinnedSet.has(i.path))]
  }, [p.tree, query, p.folders, inContent, pinnedSet])
  const span = guideSpan(groups, t.months)
  const visible = p.tab === 'meetings' ? groups.flatMap((g) => g.items) : p.tab === 'notes' ? notes : []

  // Trocar de aba ou de busca limpa o que não está mais à vista.
  useEffect(() => {
    const paths = new Set(visible.map((i) => i.path))
    setPicked((prev) => new Set([...prev].filter((x) => paths.has(x))))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.tab, query, p.tree])

  const stopPicking = (): void => {
    setPicking(false)
    setPicked(new Set())
  }
  const toggle = (path: string): void =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  const choose = (path: string): void => (picking ? toggle(path) : p.onSelect(path))
  const allPicked = visible.length > 0 && visible.every((i) => picked.has(i.path))

  return (
    <aside className={`rail${picking ? ' picking' : ''}`}>
      <div className="rail-head">
        <span className="brand">TalkFlowBy</span>
        <div className="rail-actions">
          <button className="icon-btn" onClick={p.onNewNote} aria-label={t.rail.newNote} title={t.rail.newNote}>
            <FilePlus2 size={18} strokeWidth={1.75} />
          </button>
          <button
            className={`icon-btn${picking ? ' active' : ''}`}
            onClick={() => (picking ? stopPicking() : setPicking(true))}
            aria-label={t.select.start}
            aria-pressed={picking}
            title={t.select.start}
          >
            <ListChecks size={18} strokeWidth={1.75} />
          </button>
          <button className="icon-btn" onClick={p.onSettings} aria-label={t.rail.settings} title={t.rail.settings}>
            <Settings size={18} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <label className="search">
        <Search size={15} strokeWidth={1.75} aria-hidden />
        <input className="search-input" placeholder={t.rail.search} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t.rail.search} />
      </label>

      <div className="segmented" role="tablist">
        <button role="tab" aria-selected={p.tab === 'meetings'} onClick={() => p.onTab('meetings')}>
          {t.rail.meetings}
        </button>
        <button role="tab" aria-selected={p.tab === 'notes'} onClick={() => p.onTab('notes')}>
          {t.rail.notes}
        </button>
        <button role="tab" aria-selected={p.tab === 'tasks'} onClick={() => p.onTab('tasks')}>
          {t.rail.tasks}
        </button>
      </div>

      {p.tab === 'meetings' && span && (
        <div className="guide" aria-label={t.rail.range}>
          <span>{span[0]}</span>
          <span>{span[1]}</span>
        </div>
      )}

      <nav className="list" aria-label={p.tab === 'meetings' ? t.rail.meetings : p.tab === 'tasks' ? t.rail.tasks : t.rail.notes}>
        {p.tab === 'tasks' && <TaskList tree={p.tree} query={query} selected={p.selected} onOpen={p.onSelect} />}
        {p.tab === 'meetings' &&
          groups.map((g) => (
            <section key={g.label}>
              <h3 className="list-month">{g.label}</h3>
              {g.items.map((item) => (
                <MeetingRow
                  key={item.path}
                  item={item}
                  months={t.months}
                  selected={!picking && item.path === p.selected}
                  picked={picking ? picked.has(item.path) : undefined}
                  preview={p.preview}
                  snippet={snippetFor(item)}
                  onChoose={choose}
                />
              ))}
            </section>
          ))}
        {p.tab === 'notes' &&
          notes.map((item) => (
            <button
              key={item.path}
              className={`row note-row${!picking && item.path === p.selected ? ' selected' : ''}${picked.has(item.path) ? ' picked' : ''}`}
              onClick={() => choose(item.path)}
              aria-pressed={picking ? picked.has(item.path) : undefined}
            >
              {picking ? <PickBox on={picked.has(item.path)} /> : pinnedSet.has(item.path) ? <Pin size={16} strokeWidth={1.75} aria-hidden /> : <FileText size={16} strokeWidth={1.75} aria-hidden />}
              <span className="row-body">
                <span className="row-title">{item.title}</span>
                {snippetFor(item) && <span className="row-preview">{snippetFor(item)}</span>}
              </span>
            </button>
          ))}
        {p.tab !== 'tasks' && <EmptyList tab={p.tab} query={query} empty={visible.length === 0} onNewNote={p.onNewNote} />}
      </nav>

      {!picking && <UpdateBanner />}
      {picking && (
        <div className="pick-bar">
          <div className="pick-line">
            <span className="pick-count">{t.select.count(picked.size)}</span>
            <button className="link" onClick={() => setPicked(allPicked ? new Set() : new Set(visible.map((i) => i.path)))}>
              {allPicked ? t.select.none : t.select.all}
            </button>
          </div>
          <div className="pick-line">
            <button className="btn" onClick={stopPicking}>
              {t.select.done}
            </button>
            <button
              className="btn danger"
              disabled={picked.size === 0}
              onClick={async () => {
                if (await p.onTrashMany([...picked])) stopPicking()
              }}
            >
              {t.select.trash}
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}

function PickBox({ on }: { on: boolean }): React.JSX.Element {
  return on ? <SquareCheck size={18} strokeWidth={1.75} className="pick-box on" aria-hidden /> : <Square size={18} strokeWidth={1.75} className="pick-box" aria-hidden />
}

interface RowProps {
  item: ListItem
  months: string[]
  selected: boolean
  /** Definido só no modo de seleção. */
  picked?: boolean
  preview: string
  /** Trecho onde a busca achou o texto, quando não foi pelo título. */
  snippet?: string
  onChoose: (rel: string) => void
}

function MeetingRow({ item, months, selected, picked, preview, snippet, onChoose }: RowProps): React.JSX.Element {
  const m = item.meeting
  const picking = picked !== undefined
  return (
    <button
      className={`row meeting-row${selected ? ' selected' : ''}${picked ? ' picked' : ''}`}
      onClick={() => onChoose(item.path)}
      aria-current={selected || undefined}
      aria-pressed={picking ? picked : undefined}
    >
      {picking && <PickBox on={Boolean(picked)} />}
      {m ? <DateBlock month={months[m.month - 1]} day={m.day} selected={selected || Boolean(picked)} /> : <FileText size={16} strokeWidth={1.75} aria-hidden />}
      <span className="row-body">
        <span className="row-title">{item.title}</span>
        {m && <span className="row-meta">{m.time}</span>}
        {snippet ? <span className="row-preview">{snippet}</span> : selected && preview && <span className="row-preview">{preview}</span>}
      </span>
    </button>
  )
}

function EmptyList({ tab, query, empty, onNewNote }: { tab: Tab; query: string; empty: boolean; onNewNote: () => void }): React.JSX.Element | null {
  const t = useT()
  if (!empty) return null
  if (query) return <p className="list-empty">{t.rail.nothingFound(query)}</p>
  if (tab === 'meetings') return <p className="list-empty">{t.rail.emptyMeetings}</p>
  return (
    <p className="list-empty">
      {t.rail.emptyNotes}{' '}
      <button className="link" onClick={onNewNote}>
        {t.rail.createFirst}
      </button>
    </p>
  )
}
