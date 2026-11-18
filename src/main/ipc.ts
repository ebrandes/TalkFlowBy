import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { Settings, Track } from '../shared/types'
import { askMicrophone, readPermissions } from './capture'
import type { Controller } from './controller'
import * as lib from './library'
import { searchNotes } from './search'
import { getSettings, setApiKey, tr, updateSettings } from './settings'

const root = (): string => getSettings().rootDir

/** Todos os canais entre a janela e o processo principal ficam aqui. */
export function registerIpc(c: Controller): void {
  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:update', async (_e, patch: Partial<Settings>) => {
    const next = await updateSettings(patch)
    if (patch.detectMeetings === true) await c.detector.start()
    if (patch.detectMeetings === false) c.detector.stop()
    if (patch.rootDir) c.send('library:changed', {})
    if (patch.uiLanguage) c.tray?.refresh()
    if (patch.transcriptionQuality) await c.refreshModel()
    if (patch.checkUpdates === true) c.updater.start()
    if (patch.checkUpdates === false) c.updater.stop()
    return next
  })
  ipcMain.handle('settings:setApiKey', (_e, key: string | null) => setApiKey(key))

  ipcMain.handle('library:tree', () => lib.listTree(root(), getSettings().folders))
  ipcMain.handle('library:search', (_e, query: string) => searchNotes(root(), query))
  ipcMain.handle('library:read', (_e, rel: string) => lib.readNote(root(), rel))
  ipcMain.handle('library:write', (_e, rel: string, content: string) => lib.writeNote(root(), rel, content))
  ipcMain.handle('library:create', (_e, title?: string) => lib.createNote(root(), getSettings().folders.notes, title ?? tr().main.newNote))
  ipcMain.handle('library:rename', (_e, rel: string, title: string) => lib.renameNote(root(), rel, title))
  ipcMain.handle('library:trash', (_e, rel: string) => lib.trashNote(root(), rel))
  ipcMain.handle('library:trashMany', (_e, rels: string[]) => lib.trashNotes(root(), rels))
  ipcMain.handle('library:reveal', (_e, rel: string) => lib.revealNote(root(), rel))
  ipcMain.handle('library:openRoot', () => shell.openPath(root()))
  // Trocar a pasta das notas (por exemplo, para um vault do Obsidian).
  ipcMain.handle('library:chooseRoot', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const res = await dialog.showOpenDialog(win!, { properties: ['openDirectory', 'createDirectory'], defaultPath: root() })
    if (res.canceled || !res.filePaths[0]) return getSettings()
    const next = await updateSettings({ rootDir: res.filePaths[0] })
    await lib.ensureRoot(next.rootDir, next.folders)
    c.send('library:changed', {})
    return next
  })

  ipcMain.handle('rec:begin', async (_e, origin?: string) => {
    const s = await c.store.begin(origin)
    c.setRecording(true)
    c.setStatus({ stage: 'recording' })
    return { id: s.id, startedAt: s.startedAt.toISOString() }
  })
  ipcMain.on('rec:chunk', (_e, track: Track, chunk: ArrayBuffer) => c.store.append(track, chunk))
  ipcMain.handle('rec:stop', () => c.finishRecording())
  ipcMain.handle('rec:autoStopped', (_e, info: { reason: 'silence'; minutes: number } | { reason: 'meeting'; app: string }) =>
    c.notify(info.reason === 'silence' ? tr().autoStop.silence(info.minutes) : tr().autoStop.meetingEnded(info.app))
  )
  ipcMain.handle('rec:state', () => c.recordingState())
  ipcMain.handle('rec:setPaused', (_e, paused: boolean) => c.setPaused(paused))
  ipcMain.handle('widget:command', (_e, cmd: 'pause' | 'resume' | 'stop') => c.widgetCommand(cmd))
  ipcMain.handle('pipeline:status', () => c.status)

  ipcMain.handle('model:status', () => c.refreshModel())
  ipcMain.handle('model:download', () => c.downloadModel())

  ipcMain.handle('perm:status', () => readPermissions())
  ipcMain.handle('perm:askMic', () => askMicrophone())
  ipcMain.handle('perm:openSettings', (_e, kind: 'microphone' | 'screen') => {
    if (process.platform === 'darwin') {
      const pane = kind === 'microphone' ? 'Privacy_Microphone' : 'Privacy_ScreenCapture'
      return shell.openExternal(`x-apple.systempreferences:com.apple.preference.security?${pane}`)
    }
    return shell.openExternal('ms-settings:privacy-microphone')
  })

  ipcMain.handle('prompt:answer', (_e, answer: 'record' | 'later' | 'never') => c.answerPrompt(answer))
  ipcMain.handle('window:show', () => c.show())
  ipcMain.handle('update:get', () => c.update)
  ipcMain.handle('update:apply', () => c.update && c.updater.apply(c.update))
}
