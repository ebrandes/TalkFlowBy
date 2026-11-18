import { AudioLines, FilePlus2, ListChecks, Mic } from 'lucide-react'
import { useState } from 'react'
import { dict } from '../../shared/i18n'
import type { Folders, ModelStatus } from '../../shared/types'
import { Crumbs } from './components/Crumbs'
import { NoteView } from './components/NoteView'
import { SettingsView } from './components/Settings'
import { SetupCard } from './components/Setup'
import { Sidebar, type Tab } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { useApp } from './hooks/useApp'
import { useRecording } from './hooks/useRecording'
import { guessLang, I18nProvider, useT } from './i18n'

export function App(): React.JSX.Element {
  const app = useApp()
  const lang = app.settings?.uiLanguage ?? guessLang()
  return (
    <I18nProvider lang={lang}>
      <Shell app={app} folders={app.settings?.folders ?? dict(lang).folders} />
    </I18nProvider>
  )
}

function Shell({ app, folders }: { app: ReturnType<typeof useApp>; folders: Folders }): React.JSX.Element {
  const t = useT()
  const rec = useRecording(t.recorder)
  const [tab, setTab] = useState<Tab>('meetings')
  const [showSettings, setShowSettings] = useState(false)
  const [preview, setPreview] = useState('')

  const open = (rel: string | null): void => {
    setShowSettings(false)
    setPreview('')
    if (rel) setTab(rel.startsWith(folders.notes) ? 'notes' : 'meetings')
    app.select(rel)
  }

  const newNote = async (): Promise<void> => {
    const rel = await window.talkflow.library.create()
    await app.refresh()
    open(rel)
  }

  const fallback = showSettings ? t.settings.title : tab === 'meetings' ? t.rail.meetings : t.rail.notes

  return (
    <div className={`shell platform-${window.talkflow.platform}`}>
      <Sidebar
        tree={app.tree}
        folders={folders}
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
              folders={folders}
              fallback={fallback}
              onRenamed={async (p) => {
                await app.refresh()
                app.select(p)
              }}
            />
          }
          rec={rec}
          status={app.status}
          blockedReason={app.model.ready ? null : t.bar.missingModel}
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

function Welcome({ model, tab, recording, onNewNote }: { model: ModelStatus; tab: Tab; recording: boolean; onNewNote: () => void }): React.JSX.Element {
  const t = useT().welcome
  return (
    <div className="doc">
      <div className="doc-col welcome">
        <SetupCard model={model} />
        {tab === 'meetings' ? (
          <>
            <h1>{recording ? t.recordingTitle : t.idleTitle}</h1>
            <p className="lead">{recording ? t.recordingLead : t.idleLead}</p>
            {!recording && (
              <ol className="how">
                <li>
                  <Mic size={17} strokeWidth={1.75} aria-hidden />
                  {t.how1}
                </li>
                <li>
                  <AudioLines size={17} strokeWidth={1.75} aria-hidden />
                  {t.how2}
                </li>
                <li>
                  <ListChecks size={17} strokeWidth={1.75} aria-hidden />
                  {t.how3}
                </li>
              </ol>
            )}
          </>
        ) : (
          <>
            <h1>{t.notesTitle}</h1>
            <p className="lead">{t.notesLead}</p>
            <button className="btn" onClick={onNewNote}>
              <FilePlus2 size={15} strokeWidth={1.75} aria-hidden />
              {t.newNote}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
