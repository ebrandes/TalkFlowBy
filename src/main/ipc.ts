import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { OpenTask, Settings, Track } from '../shared/types'
import { askNotes } from './ask'
import { askMicrophone, readPermissions } from './capture'
import type { Controller } from './controller'
import * as lib from './library'
import { searchNotes } from './search'
import { listOpenTasks, setTaskDone } from './tasks'
import { getApiKey, getSettings, setApiKey, tr, updateSettings } from './settings'

const root = (): string => getSettings().rootDir

/** Todos os canais entre a janela e o processo principal ficam aqui. */
export function registerIpc(c: Controller): void {
  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:update', async (_e, patch: Partial<Settings>) => {
    const next = await updateSettings(patch)
    if (patch.detectMeetings === true) await c.detector.start()
    if (patch.detectMeetings === false) c.detector.stop()
    if (patch.rootDir) {
      c.watcher.start(next.rootDir)
      c.send('library:changed', {})
    }
    if (patch.uiLanguage) c.tray?.refresh()
    if (patch.transcriptionQuality) await c.refreshModel()
    if (patch.checkUpdates === true) c.updater.start()
    if (patch.checkUpdates === false) c.updater.stop()
    return next
  })
  ipcMain.handle('settings:setApiKey', (_e, key: string | null) => setApiKey(key))

  ipcMain.handle('library:tree', () => lib.listTree(root(), getSettings().folders))
  ipcMain.handle('library:search', (_e, query: string) => searchNotes(root(), query))
  ipcMain.handle('ai:ask', (_e, question: string, path: string | null) => {
    const s = getSettings()
    return askNotes(root(), question, path, { provider: s.summaryProvider, apiKey: getApiKey(), lang: s.uiLanguage })
  })
  ipcMain.handle('library:read', (_e, rel: string) => lib.readNote(root(), rel))
  ipcMain.handle('library:write', (_e, rel: string, content: string) => lib.writeNote(root(), rel, content))
  ipcMain.handle('library:create', (_e, title?: string) => lib.createNote(root(), getSettings().folders.notes, title ?? tr().main.newNote))
  ipcMain.handle('library:rename', async (_e, rel: string, title: string) => {
    const next = await lib.renameNote(root(), rel, title)
    // Nota fixada continua fixada com o nome novo.
    const pinned = getSettings().pinned
    if (next !== rel && pinned.includes(rel)) await updateSettings({ pinned: pinned.map((p) => (p === rel ? next : p)) })
    return next
  })
  ipcMain.handle('library:trash', async (_e, rel: string) => (await lib.trashNotes(root(), [rel])).undoId)
  ipcMain.handle('library:trashMany', (_e, rels: string[]) => lib.trashNotes(root(), rels))
  ipcMain.handle('library:undoTrash', (_e, id: string) => lib.undoTrash(id))
  ipcMain.handle('library:tasks', () => listOpenTasks(root()))
  ipcMain.handle('library:setTask', async (_e, task: OpenTask, done: boolean) => {
    const ok = await setTaskDone(root(), task, done)
    // A nota pode estar aberta no editor: recarrega sem aviso, para a marcação não se perder.
    if (ok) c.send('note:changedOutside', { path: task.path, quiet: true })
    return ok
  })
  ipcMain.handle('library:setPinned', async (_e, rel: string, pinned: boolean) => {
    const set = new Set(getSettings().pinned)
    if (pinned) set.add(rel)
    else set.delete(rel)
    return updateSettings({ pinned: [...set] })
  })
  ipcMain.handle('note:resummarize', (_e, rel: string) => c.resummarize(rel))
  ipcMain.handle('library:reveal', (_e, rel: string) => lib.revealNote(root(), rel))
  ipcMain.handle('library:openRoot', () => shell.openPath(root()))
  // Trocar a pasta das notas (por exemplo, para um vault do Obsidian).
  ipcMain.handle('library:chooseRoot', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const res = await dialog.showOpenDialog(win!, { properties: ['openDirectory', 'createDirectory'], defaultPath: root() })
    if (res.canceled || !res.filePaths[0]) return getSettings()
    const next = await updateSettings({ rootDir: res.filePaths[0] })
    await lib.ensureRoot(next.rootDir, next.folders)
    c.watcher.start(next.rootDir)
    c.send('library:changed', {})
    return next
  })

  ipcMain.handle('rec:begin', async (_e, origin?: string) => {
    const s = await c.store.begin(origin)
    void c.startLive(s.dir)
    void c.warnIfLowDisk()
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
  ipcMain.handle('widget:command', (_e, cmd: 'pause' | 'resume' | 'stop' | 'capture') => c.widgetCommand(cmd))
  ipcMain.handle('pipeline:status', () => c.status)
  ipcMain.handle('recordings:failed', async () => (await c.failedRecordings()).map(({ dir: _dir, ...rest }) => rest))
  ipcMain.handle('recordings:retry', (_e, id: string) => c.retryRecording(id))
  ipcMain.handle('recordings:discard', (_e, id: string) => c.discardRecording(id))

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
