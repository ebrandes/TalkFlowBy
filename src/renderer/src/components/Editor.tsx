import { Crepe } from '@milkdown/crepe'
import '@milkdown/crepe/theme/common/style.css'
import { useEffect, useRef } from 'react'
import { CREPE_CONFIG, CREPE_FEATURES } from './editor-config'

interface Props {
  /** Muda quando outra nota é aberta; recria o editor. */
  docKey: string
  value: string
  onChange: (markdown: string) => void
}

/** Editor de blocos sobre markdown puro. Salvar fica com quem usa o componente. */
export function Editor({ docKey, value, onChange }: Props): React.JSX.Element {
  const host = useRef<HTMLDivElement>(null)
  const changeRef = useRef(onChange)
  changeRef.current = onChange

  useEffect(() => {
    if (!host.current) return
    let alive = true
    const crepe = new Crepe({
      root: host.current,
      defaultValue: value,
      features: CREPE_FEATURES,
      featureConfigs: CREPE_CONFIG
    })
    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown, prev) => {
        if (alive && markdown !== prev) changeRef.current(markdown)
      })
    })
    void crepe.create()
    return () => {
      alive = false
      void crepe.destroy()
    }
    // O conteúdo inicial só importa quando a nota muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docKey])

  return <div className="editor" ref={host} />
}
