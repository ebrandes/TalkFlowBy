import { Crepe } from '@milkdown/crepe'
import {
  Bold,
  Check,
  Circle,
  Code,
  GripVertical,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Pencil,
  Pilcrow,
  Plus,
  Quote,
  SquareCheck,
  Square,
  Strikethrough,
  Trash2,
  type LucideIcon
} from 'lucide-react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Dict } from '../../../shared/i18n'

/** O editor recebe ícones como texto SVG; aqui saem todos do Lucide, no mesmo traço. */
const svg = (Icon: LucideIcon, size = 18, filled = false): string =>
  renderToStaticMarkup(<Icon size={size} strokeWidth={1.75} fill={filled ? 'currentColor' : 'none'} aria-hidden />)

export const CREPE_FEATURES = {
  [Crepe.Feature.CodeMirror]: false,
  [Crepe.Feature.ImageBlock]: false,
  [Crepe.Feature.Latex]: false,
  [Crepe.Feature.Table]: false,
  [Crepe.Feature.TopBar]: false,
  [Crepe.Feature.AI]: false
}

/** Configuração do editor no idioma do app. */
export function crepeConfig(t: Dict['editor']) {
  return {
    [Crepe.Feature.Placeholder]: { text: t.placeholder, mode: 'block' as const },
    [Crepe.Feature.Cursor]: { color: false as const },
    [Crepe.Feature.ListItem]: {
      bulletIcon: svg(Circle, 7, true),
      checkBoxCheckedIcon: svg(SquareCheck),
      checkBoxUncheckedIcon: svg(Square)
    },
    [Crepe.Feature.LinkTooltip]: {
      linkIcon: svg(Link, 16),
      editButton: svg(Pencil, 16),
      removeButton: svg(Trash2, 16),
      confirmButton: svg(Check, 16),
      inputPlaceholder: t.linkPlaceholder,
      onCopyLink: (link: string) => void navigator.clipboard.writeText(link)
    },
    [Crepe.Feature.Toolbar]: {
      boldIcon: svg(Bold, 16),
      italicIcon: svg(Italic, 16),
      strikethroughIcon: svg(Strikethrough, 16),
      codeIcon: svg(Code, 16),
      linkIcon: svg(Link, 16),
      boldLabel: t.bold,
      italicLabel: t.italic,
      strikethroughLabel: t.strike,
      codeLabel: t.code,
      linkLabel: t.link
    },
    [Crepe.Feature.BlockEdit]: {
      handleAddIcon: svg(Plus, 16),
      handleDragIcon: svg(GripVertical, 16),
      textGroup: {
        label: t.text,
        text: { label: t.paragraph, icon: svg(Pilcrow) },
        h1: { label: t.h1, icon: svg(Heading1) },
        h2: { label: t.h2, icon: svg(Heading2) },
        h3: { label: t.h3, icon: svg(Heading3) },
        h4: null,
        h5: null,
        h6: null,
        quote: { label: t.quote, icon: svg(Quote) },
        divider: { label: t.divider, icon: svg(Minus) }
      },
      listGroup: {
        label: t.lists,
        bulletList: { label: t.bullet, icon: svg(List) },
        orderedList: { label: t.ordered, icon: svg(ListOrdered) },
        taskList: { label: t.task, icon: svg(ListChecks) }
      },
      advancedGroup: null
    }
  }
}
