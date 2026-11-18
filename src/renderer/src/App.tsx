import { AudioLines, FilePlus2, ListChecks, Mic } from 'lucide-react'
import { useState } from 'react'
import { Crumbs } from './components/Crumbs'
import { NoteView } from './components/NoteView'
import { SettingsView } from './components/Settings'
import { SetupCard } from './components/Setup'
import { Sidebar, type Tab } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { useApp } from './hooks/useApp'
import { useRecording } from './hooks/useRecording'

export function App(): React.JSX.Element {
  const app = useApp()
  const rec = useRecording()
  const [tab, setTab] = useState<Tab>('meetings')
  const [showSettings, setShowSettings] = useState(false)
  const [preview, setPreview] = useState('')

  const open = (rel: string | null): void => {
    setShowSettings(false)
    setPreview('')
    if (rel) setTab(rel.startsWith('Notas') ? 'notes' : 'meetings')
    app.select(rel)
  }

  const newNote = async (): Promise<void> => {
    const rel = await window.talkflow.library.create('Nova nota')
    await app.refresh()
    open(rel)
  }

  const fallback = showSettings ? 'Configurações' : tab === 'meetings' ? 'Reuniões' : 'Notas'

  return (
    <div className={`shell platform-${window.talkflow.platform}`}>
      <Sidebar
        tree={app.tree}
        tab={tab}
        onTab={setTab}
        selected={app.selected}
        preview={preview}
        onSelect={open}
        onNewNote={() => void newNote()}
        onSettings={() => setShowSettings(true)}
      />
      <main className="main">
        <TopBar
          crumbs={
            <Crumbs
              path={showSettings ? null : app.selected}
              fallback={fallback}
              onRenamed={async (p) => {
                await app.refresh()
                app.select(p)
              }}
            />
          }
          rec={rec}
          status={app.status}
          blockedReason={app.model.ready ? null : 'Falta o modelo de transcrição'}
        />
        {showSettings && app.settings ? (
          <SettingsView settings={app.settings} model={app.model} onChange={app.setSettings} onClose={() => setShowSettings(false)} />
        ) : app.selected ? (
          <NoteView
            path={app.selected}
            onPreview={setPreview}
            onDeleted={async () => {
              await app.refresh()
              open(null)
            }}
          />
        ) : (
          <Welcome model={app.model} tab={tab} recording={rec.recording} onNewNote={() => void newNote()} />
        )}
      </main>
    </div>
  )
}

function Welcome({ model, tab, recording, onNewNote }: { model: import('../../shared/types').ModelStatus; tab: Tab; recording: boolean; onNewNote: () => void }): React.JSX.Element {
  return (
    <div className="doc">
      <div className="doc-col welcome">
        <SetupCard model={model} />
        {tab === 'meetings' ? (
          <>
            <h1>{recording ? 'Gravando a reunião' : 'Nenhuma reunião aberta'}</h1>
            <p className="lead">
              {recording
                ? 'Pode seguir na chamada. Quando parar, a transcrição e o resumo aparecem na lista em alguns minutos.'
                : 'Clique em Gravar no topo, ou responda Gravar no aviso que aparece quando você entra no Teams ou no Google Meet.'}
            </p>
            {!recording && (
              <ol className="how">
                <li>
                  <Mic size={17} strokeWidth={1.75} aria-hidden />
                  Grava a sua voz e o áudio da chamada, sem robô entrando na reunião.
                </li>
                <li>
                  <AudioLines size={17} strokeWidth={1.75} aria-hidden />
                  Transcreve neste computador, separando você dos outros.
                </li>
                <li>
                  <ListChecks size={17} strokeWidth={1.75} aria-hidden />
                  O Claude Haiku organiza em resumo, decisões e próximos passos.
                </li>
              </ol>
            )}
          </>
        ) : (
          <>
            <h1>Nenhuma nota aberta</h1>
            <p className="lead">Escolha uma nota na lista ou comece uma nova. Digite / dentro da nota para inserir títulos, listas e tarefas.</p>
            <button className="btn" onClick={onNewNote}>
              <FilePlus2 size={15} strokeWidth={1.75} aria-hidden />
              Nova nota
            </button>
          </>
        )}
      </div>
    </div>
  )
}
