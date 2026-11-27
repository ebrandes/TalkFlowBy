// Tipos compartilhados entre o processo principal, o preload e a janela.

export type Speaker = 'Você' | 'Outros'

/** Trecho transcrito de uma trilha, em segundos desde o início da gravação. */
export interface Segment {
  speaker: Speaker
  start: number
  end: number
  text: string
}

/** Turno de fala: segmentos seguidos da mesma pessoa agrupados num parágrafo. */
export interface Turn {
  speaker: Speaker
  start: number
  text: string
}

export interface Topic {
  titulo: string
  pontos: string[]
}

export interface Task {
  tarefa: string
  responsavel?: string
}

/** Fluxo de trabalho descrito na reunião, quando houver. */
export interface Flow {
  titulo: string
  passos: { id: string; rotulo: string }[]
  ligacoes: { de: string; para: string; rotulo?: string }[]
}

/** O que o Haiku devolve. O markdown é montado em código a partir disto. */
export interface Summary {
  assunto: string
  resumo: string
  topicos: Topic[]
  decisoes: string[]
  tarefas: Task[]
  fluxo?: Flow | null
}

export interface MeetingMeta {
  startedAt: Date
  durationSec: number
  origin?: string
}

export type NodeKind = 'folder' | 'file'

export interface LibraryNode {
  kind: NodeKind
  name: string
  /** Caminho relativo à pasta raiz, com `/`. */
  path: string
  modifiedAt?: number
  children?: LibraryNode[]
}

export type SummaryProvider = 'auto' | 'claude-cli' | 'api'

export type UiLang = 'en' | 'pt'

export interface Folders {
  meetings: string
  notes: string
}

export interface Settings {
  rootDir: string
  uiLanguage: UiLang
  /** Nomes das pastas, fixados na primeira abertura para não mudar de lugar depois. */
  folders: Folders
  language: string
  summaryProvider: SummaryProvider
  hasApiKey: boolean
  keepAudio: boolean
  detectMeetings: boolean
  /** Modelo do Whisper: melhor, equilibrado ou mais rápido. */
  transcriptionQuality: import('./models').TranscriptionQuality
  /** Desenhar o fluxo no fim da nota quando a reunião descreve um processo. */
  drawFlows: boolean
  /** Minutos sem som para parar a gravação sozinha; 0 desliga. */
  silenceStopMinutes: number
  mutedApps: string[]
  /** Procurar versão nova no GitHub. */
  checkUpdates: boolean
  openAtLogin: boolean
  /** Endereço do repositório Git para sincronizar as notas entre computadores; vazio desliga. */
  syncRemote: string
}

export type SyncState = 'off' | 'idle' | 'syncing' | 'error'

export interface SyncStatus {
  state: SyncState
  /** Última sincronização que deu certo, em ISO. */
  lastSync?: string
  /** Código do erro (`auth`, `offline`, `not-found`, `git-missing`) ou o texto do Git. */
  error?: string
  /** Conflitos da última rodada: a versão do outro computador ficou ao lado. */
  conflicts?: number
  /** Pasta do backup feito antes da primeira sincronização. */
  backup?: string
}

export type PipelineStage =
  | 'idle'
  | 'recording'
  | 'converting'
  | 'transcribing'
  | 'summarizing'
  | 'saving'
  | 'done'
  | 'error'

export interface PipelineStatus {
  stage: PipelineStage
  /** 0 a 1 quando a etapa informa progresso. */
  progress?: number
  message?: string
  /** Caminho relativo da nota criada, quando `stage` é `done`. */
  notePath?: string
  /** Qual gravação está sendo processada, por exemplo "17 nov 14:30". */
  meeting?: string
}

export interface DetectedMeeting {
  appId: string
  appName: string
}

export interface ModelStatus {
  ready: boolean
  path?: string
  downloading?: boolean
  progress?: number
  error?: string
}

export type Track = 'mic' | 'system'
