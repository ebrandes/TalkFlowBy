/** O que a janela principal e o widget flutuante precisam saber da gravação em andamento. */
export interface RecordingState {
  recording: boolean
  startedAt: string | null
  origin: string | null
  paused: boolean
  /** Tempo já passado em pausa, sem contar a pausa atual. */
  pausedMs: number
  /** Quando a pausa atual começou. */
  pausedAt: string | null
  /** Quantas capturas de tela já foram feitas nesta gravação. */
  shots: number
}

/** Dados extras de uma gravação que começou pela detecção de reunião. */
export interface StartExtra {
  title?: string
  auto?: boolean
  appId?: string
}

/** Ordem de começar a gravar, vinda da bandeja, do aviso de reunião ou da detecção. */
export interface StartCommand extends StartExtra {
  origin?: string
  /** Fecha a gravação atual antes (outra reunião começou). */
  restart?: boolean
}

export const IDLE: RecordingState = { recording: false, startedAt: null, origin: null, paused: false, pausedMs: 0, pausedAt: null, shots: 0 }

/** Segundos gravados de fato: do início até agora, menos as pausas. */
export function elapsedSec(s: RecordingState, now = Date.now()): number {
  if (!s.recording || !s.startedAt) return 0
  const current = s.paused && s.pausedAt ? now - new Date(s.pausedAt).getTime() : 0
  return Math.max(0, Math.floor((now - new Date(s.startedAt).getTime() - s.pausedMs - current) / 1000))
}
