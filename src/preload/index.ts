import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { LibraryNode, ModelStatus, PipelineStatus, Settings, Track } from '../shared/types'

type Unsubscribe = () => void

function on<T>(channel: string, cb: (payload: T) => void): Unsubscribe {
  const handler = (_e: IpcRendererEvent, payload: T): void => cb(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

export interface RecordingState {
  recording: boolean
  startedAt: string | null
  origin: string | null
}

export interface Permissions {
  microphone: string
  screen: string
}

const api = {
  platform: process.platform,
  settings: {
    get: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
    update: (patch: Partial<Settings>): Promise<Settings> => ipcRenderer.invoke('settings:update', patch),
    setApiKey: (key: string | null): Promise<Settings> => ipcRenderer.invoke('settings:setApiKey', key)
  },
  library: {
    tree: (): Promise<LibraryNode[]> => ipcRenderer.invoke('library:tree'),
    read: (rel: string): Promise<string> => ipcRenderer.invoke('library:read', rel),
    search: (query: string): Promise<{ path: string; snippet: string }[]> => ipcRenderer.invoke('library:search', query),
    write: (rel: string, content: string): Promise<void> => ipcRenderer.invoke('library:write', rel, content),
    create: (title?: string): Promise<string> => ipcRenderer.invoke('library:create', title),
    rename: (rel: string, title: string): Promise<string> => ipcRenderer.invoke('library:rename', rel, title),
    trash: (rel: string): Promise<void> => ipcRenderer.invoke('library:trash', rel),
    trashMany: (rels: string[]): Promise<number> => ipcRenderer.invoke('library:trashMany', rels),
    reveal: (rel: string): Promise<void> => ipcRenderer.invoke('library:reveal', rel),
    openRoot: (): Promise<string> => ipcRenderer.invoke('library:openRoot'),
    chooseRoot: (): Promise<Settings> => ipcRenderer.invoke('library:chooseRoot'),
    onChanged: (cb: (p: { open?: string }) => void): Unsubscribe => on('library:changed', cb)
  },
  recording: {
    begin: (origin?: string): Promise<{ id: string; startedAt: string }> => ipcRenderer.invoke('rec:begin', origin),
    chunk: (track: Track, data: ArrayBuffer): void => ipcRenderer.send('rec:chunk', track, data),
    stop: (): Promise<void> => ipcRenderer.invoke('rec:stop'),
    autoStopped: (info: { reason: 'silence'; minutes: number } | { reason: 'meeting'; app: string }): Promise<void> =>
      ipcRenderer.invoke('rec:autoStopped', info),
    state: (): Promise<RecordingState> => ipcRenderer.invoke('rec:state'),
    onState: (cb: (s: RecordingState) => void): Unsubscribe => on('recording:state', cb),
    onStartCommand: (cb: (p: { origin?: string }) => void): Unsubscribe => on('command:start', cb),
    onStopCommand: (cb: (p: { reason?: string; app?: string }) => void): Unsubscribe => on('command:stop', cb)
  },
  pipeline: {
    status: (): Promise<PipelineStatus> => ipcRenderer.invoke('pipeline:status'),
    onStatus: (cb: (s: PipelineStatus) => void): Unsubscribe => on('pipeline:status', cb)
  },
  model: {
    status: (): Promise<ModelStatus> => ipcRenderer.invoke('model:status'),
    download: (): Promise<void> => ipcRenderer.invoke('model:download'),
    onStatus: (cb: (s: ModelStatus) => void): Unsubscribe => on('model:status', cb)
  },
  permissions: {
    status: (): Promise<Permissions> => ipcRenderer.invoke('perm:status'),
    askMic: (): Promise<boolean> => ipcRenderer.invoke('perm:askMic'),
    openSettings: (kind: 'microphone' | 'screen'): Promise<void> => ipcRenderer.invoke('perm:openSettings', kind)
  },
  prompt: {
    answer: (answer: 'record' | 'later' | 'never'): Promise<void> => ipcRenderer.invoke('prompt:answer', answer)
  },
  window: { show: (): Promise<void> => ipcRenderer.invoke('window:show') },
  update: {
    get: (): Promise<{ version: string; state: 'available' | 'ready' } | null> => ipcRenderer.invoke('update:get'),
    apply: (): Promise<void> => ipcRenderer.invoke('update:apply'),
    onInfo: (cb: (info: { version: string; state: 'available' | 'ready' }) => void): Unsubscribe => on('update:info', cb)
  }
}

contextBridge.exposeInMainWorld('talkflow', api)

export type TalkflowApi = typeof api
