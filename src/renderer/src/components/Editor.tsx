import { Crepe } from '@milkdown/crepe'
import '@milkdown/crepe/theme/common/style.css'
import { remarkStringifyOptionsCtx } from '@milkdown/kit/core'
import { remarkPreserveEmptyLinePlugin } from '@milkdown/kit/preset/commonmark'
import { useEffect, useRef } from 'react'
import { useT } from '../i18n'
import { CREPE_FEATURES, crepeConfig } from './editor-config'

/** Imagem com caminho relativo à nota (o diagrama do fluxo) vira um endereço que o app sabe servir. */
export function noteFileUrl(notePath: string, url: string): string {
  if (/^(https?|data|blob|tfb-file):/i.test(url)) return url
  const dir = notePath.includes('/') ? notePath.slice(0, notePath.lastIndexOf('/') + 1) : ''
  return `tfb-file://note/${encodeURIComponent(dir + decodeURI(url))}`
}

interface Props {
  /** Muda quando outra nota é aberta; recria o editor. */
  docKey: string
  value: string
  onChange: (markdown: string) => void
}

/**
 * Editor de blocos sobre markdown puro. Salvar fica com quem usa o componente.
 * Só avisa mudança quando o texto muda de verdade: abrir uma nota nunca regrava o arquivo.
 */
export function Editor({ docKey, value, onChange }: Props): React.JSX.Element {
  const t = useT()
  const host = useRef<HTMLDivElement>(null)
  const changeRef = useRef(onChange)
  changeRef.current = onChange

  useEffect(() => {
    if (!host.current) return
    let alive = true
    let baseline: string | null = null
    const crepe = new Crepe({
      root: host.current,
      defaultValue: value,
      features: CREPE_FEATURES,
      featureConfigs: crepeConfig(t.editor, (url) => noteFileUrl(docKey, url))
    })
    // Mesmo formato que o TalkFlowBy escreve: listas com "-" e sem <br /> para linha vazia.
    crepe.editor.config((ctx) => {
      ctx.update(remarkStringifyOptionsCtx, (prev) => ({ ...prev, bullet: '-' as const, rule: '-' as const, listItemIndent: 'one' as const }))
    })
    crepe.editor.remove(remarkPreserveEmptyLinePlugin)
    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => {
        if (alive && baseline !== null && markdown !== baseline) changeRef.current(markdown)
      })
    })
    void crepe.create().then(() => {
      if (alive) baseline = crepe.getMarkdown()
    })
    return () => {
      alive = false
      void crepe.destroy()
    }
    // O conteúdo inicial e os rótulos só importam quando a nota muda (trocar o idioma vale na próxima nota aberta).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docKey])

  return <div className="editor" ref={host} />
}
