import { FilePlus2, FileText, Search, Settings } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { LibraryNode } from '../../../shared/types'
import { MONTHS, guideSpan, meetingGroups, noteItems, type ListItem } from '../lib/notes'
import { DateBlock } from './Stamp'

export type Tab = 'meetings' | 'notes'

interface Props {
  tree: LibraryNode[]
  tab: Tab
  onTab: (t: Tab) => void
  selected: string | null
  preview: string
  onSelect: (rel: string) => void
  onNewNote: () => void
  onSettings: () => void
}

export function Sidebar(p: Props): React.JSX.Element {
  const [query, setQuery] = useState('')
  const groups = useMemo(() => meetingGroups(p.tree, query), [p.tree, query])
  const notes = useMemo(() => noteItems(p.tree, query), [p.tree, query])
  const span = guideSpan(groups)

  return (
    <aside className="rail">
      <div className="rail-head">
        <span className="brand">TalkFlowBy</span>
        <div className="rail-actions">
          <button className="icon-btn" onClick={p.onNewNote} aria-label="Nova nota" title="Nova nota">
            <FilePlus2 size={18} strokeWidth={1.75} />
          </button>
          <button className="icon-btn" onClick={p.onSettings} aria-label="Configurações" title="Configurações">
            <Settings size={18} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <label className="search">
        <Search size={15} strokeWidth={1.75} aria-hidden />
        <input
          className="search-input"
          placeholder="Buscar pelo título"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar pelo título"
        />
      </label>

      <div className="segmented" role="tablist">
        <button role="tab" aria-selected={p.tab === 'meetings'} onClick={() => p.onTab('meetings')}>
          Reuniões
        </button>
        <button role="tab" aria-selected={p.tab === 'notes'} onClick={() => p.onTab('notes')}>
          Notas
        </button>
      </div>

      {p.tab === 'meetings' && span && (
        <div className="guide" aria-label="Intervalo listado">
          <span>{span[0]}</span>
          <span>{span[1]}</span>
        </div>
      )}

      <nav className="list" aria-label={p.tab === 'meetings' ? 'Reuniões' : 'Notas'}>
        {p.tab === 'meetings' &&
          groups.map((g) => (
            <section key={g.label}>
              <h3 className="list-month">{g.label}</h3>
              {g.items.map((item) => (
                <MeetingRow key={item.path} item={item} selected={item.path === p.selected} preview={p.preview} onSelect={p.onSelect} />
              ))}
            </section>
          ))}
        {p.tab === 'notes' &&
          notes.map((item) => (
            <button
              key={item.path}
              className={`row note-row${item.path === p.selected ? ' selected' : ''}`}
              onClick={() => p.onSelect(item.path)}
            >
              <FileText size={16} strokeWidth={1.75} aria-hidden />
              <span className="row-title">{item.title}</span>
            </button>
          ))}
        <EmptyList tab={p.tab} query={query} empty={p.tab === 'meetings' ? groups.length === 0 : notes.length === 0} onNewNote={p.onNewNote} />
      </nav>
    </aside>
  )
}

function MeetingRow({ item, selected, preview, onSelect }: { item: ListItem; selected: boolean; preview: string; onSelect: (rel: string) => void }): React.JSX.Element {
  const m = item.meeting
  return (
    <button className={`row meeting-row${selected ? ' selected' : ''}`} onClick={() => onSelect(item.path)} aria-current={selected || undefined}>
      {m ? <DateBlock month={MONTHS[m.month - 1]} day={m.day} selected={selected} /> : <FileText size={16} strokeWidth={1.75} aria-hidden />}
      <span className="row-body">
        <span className="row-title">{item.title}</span>
        {m && <span className="row-meta">{m.time}</span>}
        {selected && preview && <span className="row-preview">{preview}</span>}
      </span>
    </button>
  )
}

function EmptyList({ tab, query, empty, onNewNote }: { tab: Tab; query: string; empty: boolean; onNewNote: () => void }): React.JSX.Element | null {
  if (!empty) return null
  if (query) return <p className="list-empty">Nada com “{query}” no título.</p>
  if (tab === 'meetings') {
    return <p className="list-empty">As reuniões gravadas aparecem aqui, organizadas por mês.</p>
  }
  return (
    <p className="list-empty">
      Notas soltas ficam aqui.{' '}
      <button className="link" onClick={onNewNote}>
        Criar a primeira
      </button>
    </p>
  )
}
