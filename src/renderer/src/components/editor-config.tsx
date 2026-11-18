import { Crepe } from '@milkdown/crepe'
import {
  Bold,
  Check,
  Circle,
  Code,
  Copy,
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

export const CREPE_CONFIG = {
  [Crepe.Feature.Placeholder]: { text: 'Escreva aqui, ou digite / para inserir um bloco', mode: 'block' as const },
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
    inputPlaceholder: 'Cole ou digite o endereço',
    onCopyLink: (link: string) => void navigator.clipboard.writeText(link)
  },
  [Crepe.Feature.Toolbar]: {
    boldIcon: svg(Bold, 16),
    italicIcon: svg(Italic, 16),
    strikethroughIcon: svg(Strikethrough, 16),
    codeIcon: svg(Code, 16),
    linkIcon: svg(Link, 16),
    boldLabel: 'Negrito',
    italicLabel: 'Itálico',
    strikethroughLabel: 'Riscado',
    codeLabel: 'Código',
    linkLabel: 'Link'
  },
  [Crepe.Feature.BlockEdit]: {
    handleAddIcon: svg(Plus, 16),
    handleDragIcon: svg(GripVertical, 16),
    textGroup: {
      label: 'Texto',
      text: { label: 'Parágrafo', icon: svg(Pilcrow) },
      h1: { label: 'Título grande', icon: svg(Heading1) },
      h2: { label: 'Título médio', icon: svg(Heading2) },
      h3: { label: 'Título pequeno', icon: svg(Heading3) },
      h4: null,
      h5: null,
      h6: null,
      quote: { label: 'Citação', icon: svg(Quote) },
      divider: { label: 'Divisória', icon: svg(Minus) }
    },
    listGroup: {
      label: 'Listas',
      bulletList: { label: 'Lista', icon: svg(List) },
      orderedList: { label: 'Lista numerada', icon: svg(ListOrdered) },
      taskList: { label: 'Tarefas', icon: svg(ListChecks) }
    },
    advancedGroup: null
  }
}

export const copyIcon = svg(Copy, 16)
