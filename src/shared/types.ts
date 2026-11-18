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

/** O que o Haiku devolve. O markdown é montado em código a partir disto. */
export interface Summary {
  assunto: string
  resumo: string
  topicos: Topic[]
  decisoes: string[]
  tarefas: Task[]
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

export interface Settings {
  rootDir: string
  language: string
  summaryProvider: SummaryProvider
  hasApiKey: boolean
  keepAudio: boolean
  detectMeetings: boolean
  mutedApps: string[]
  openAtLogin: boolean
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
