import { useCallback, useEffect, useRef, useState } from 'react'
import type { LibraryNode, ModelStatus, PipelineStatus, Settings } from '../../../shared/types'

export interface AppData {
  tree: LibraryNode[]
  settings: Settings | null
  model: ModelStatus
  status: PipelineStatus
  selected: string | null
  /** Muda quando a nota aberta chega atualizada de outro computador, para o editor recarregar. */
  revision: number
  select: (rel: string | null) => void
  refresh: () => Promise<void>
  setSettings: (s: Settings) => void
}

/** Lista de arquivos, configurações, modelo e andamento do processamento. */
export function useApp(): AppData {
  const [tree, setTree] = useState<LibraryNode[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [model, setModel] = useState<ModelStatus>({ ready: false })
  const [status, setStatus] = useState<PipelineStatus>({ stage: 'idle' })
  const [selected, setSelected] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const selectedRef = useRef<string | null>(null)
  selectedRef.current = selected

  const refresh = useCallback(async () => setTree(await window.talkflow.library.tree()), [])

  useEffect(() => {
    const t = window.talkflow
    void refresh()
    void t.settings.get().then(setSettings)
    void t.model.status().then(setModel)
    void t.pipeline.status().then(setStatus)
    const offs = [
      t.library.onChanged(async (p) => {
        await refresh()
        if (p.open) setSelected(p.open)
        if (selectedRef.current && p.synced?.includes(selectedRef.current)) setRevision((n) => n + 1)
      }),
      t.model.onStatus(setModel),
      t.pipeline.onStatus(setStatus)
    ]
    const onFocus = (): void => void refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      offs.forEach((off) => off())
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh])

  return { tree, settings, model, status, selected, revision, select: setSelected, refresh, setSettings }
}
