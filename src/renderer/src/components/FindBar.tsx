import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { findRanges, stepIndex } from '../lib/find'

interface Props {
  /** Onde procurar (o texto do editor). */
  root: React.RefObject<HTMLElement | null>
  onClose: () => void
}

const ALL = 'tfb-find'
const CURRENT = 'tfb-find-current'

/** Destaques pelo CSS Custom Highlight API: não mexe no DOM do editor, então não suja a nota. */
function paint(ranges: Range[], current: number): void {
  if (typeof CSS === 'undefined' || !('highlights' in CSS)) return
  CSS.highlights.set(ALL, new Highlight(...ranges))
  if (current >= 0 && ranges[current]) CSS.highlights.set(CURRENT, new Highlight(ranges[current]))
  else CSS.highlights.delete(CURRENT)
}

function clear(): void {
  if (typeof CSS === 'undefined' || !('highlights' in CSS)) return
  CSS.highlights.delete(ALL)
  CSS.highlights.delete(CURRENT)
}

function reveal(range: Range | undefined): void {
  const el = range?.startContainer.parentElement
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

/** Barra de busca da nota (Ctrl+F / ⌘F): destaca todas as ocorrências e anda entre elas. */
export function FindBar({ root, onClose }: Props): React.JSX.Element {
  const t = useT().find
  const input = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [ranges, setRanges] = useState<Range[]>([])
  const [current, setCurrent] = useState(-1)
  const currentRef = useRef(current)
  currentRef.current = current

  useEffect(() => {
    input.current?.focus()
    input.current?.select()
  }, [])

  // Ctrl+F de novo com a barra aberta: volta o foco para a busca.
  useEffect(() => {
    const refocus = (): void => {
      input.current?.focus()
      input.current?.select()
    }
    window.addEventListener('tfb-find-focus', refocus)
    return () => window.removeEventListener('tfb-find-focus', refocus)
  }, [])

  // Refaz a busca quando o texto muda (inclusive enquanto a pessoa edita a nota).
  useEffect(() => {
    const host = root.current
    if (!host) return
    let frame = 0
    const run = (first: boolean): void => {
      const found = findRanges(host, query)
      setRanges(found)
      const next = found.length === 0 ? -1 : first ? 0 : Math.min(Math.max(currentRef.current, 0), found.length - 1)
      setCurrent(next)
      if (first) reveal(found[next])
    }
    run(true)
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => run(false))
    })
    observer.observe(host, { subtree: true, childList: true, characterData: true })
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [query, root])

  useEffect(() => paint(ranges, current), [ranges, current])
  useEffect(() => clear, [])

  const go = (step: number): void => {
    const next = stepIndex(current, ranges.length, step)
    setCurrent(next)
    reveal(ranges[next])
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      go(e.shiftKey ? -1 : 1)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  const count = query.trim() ? (ranges.length ? t.count(current + 1, ranges.length) : t.none) : ''

  return (
    <div className="find-dock">
      <div className="find-bar" role="search">
        <input
          ref={input}
          className="find-input"
          type="search"
          value={query}
          placeholder={t.placeholder}
          aria-label={t.placeholder}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <span className="find-count" aria-live="polite">
          {count}
        </span>
        <button className="icon-btn" title={t.prev} aria-label={t.prev} disabled={ranges.length === 0} onClick={() => go(-1)}>
          <ChevronUp size={16} strokeWidth={1.75} />
        </button>
        <button className="icon-btn" title={t.next} aria-label={t.next} disabled={ranges.length === 0} onClick={() => go(1)}>
          <ChevronDown size={16} strokeWidth={1.75} />
        </button>
        <button className="icon-btn" title={t.close} aria-label={t.close} onClick={onClose}>
          <X size={16} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  )
}
