import type { Track } from '../../shared/types'

const MIME = 'audio/webm;codecs=opus'
const SLICE_MS = 5_000

export interface RecorderStart {
  /** false quando o sistema não liberou o áudio da chamada; grava só o microfone. */
  systemAudio: boolean
}

/**
 * Grava duas trilhas separadas: microfone ("Você") e áudio do sistema ("Outros").
 * Os pedaços vão para o processo principal a cada 5 s, então uma queda do app perde no máximo isso.
 */
export class Recorder {
  private recorders: MediaRecorder[] = []
  private streams: MediaStream[] = []
  private pending: Promise<void>[] = []

  get active(): boolean {
    return this.recorders.length > 0
  }

  async start(origin?: string): Promise<RecorderStart> {
    if (this.active) return { systemAudio: true }
    const mic = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    })
    this.streams.push(mic)

    let systemAudio = false
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 1 }, audio: true })
      display.getVideoTracks().forEach((t) => t.stop())
      const audio = display.getAudioTracks()[0]
      if (audio && audio.readyState === 'live') {
        const sys = new MediaStream([audio])
        this.streams.push(sys)
        this.record(sys, 'system')
        systemAudio = true
      }
    } catch {
      systemAudio = false
    }

    await window.talkflow.recording.begin(origin)
    this.record(mic, 'mic')
    return { systemAudio }
  }

  private record(stream: MediaStream, track: Track): void {
    const rec = new MediaRecorder(stream, { mimeType: MIME, audioBitsPerSecond: 48_000 })
    rec.ondataavailable = (e) => {
      if (e.data.size === 0) return
      this.pending.push(e.data.arrayBuffer().then((buf) => window.talkflow.recording.chunk(track, buf)))
    }
    rec.start(SLICE_MS)
    this.recorders.push(rec)
  }

  /** Para tudo, espera os últimos pedaços chegarem e só então fecha a sessão. */
  async stop(): Promise<void> {
    const stopped = this.recorders.map(
      (r) =>
        new Promise<void>((resolve) => {
          if (r.state === 'inactive') return resolve()
          r.addEventListener('stop', () => resolve(), { once: true })
          r.stop()
        })
    )
    await Promise.all(stopped)
    await Promise.all(this.pending)
    this.streams.forEach((s) => s.getTracks().forEach((t) => t.stop()))
    this.recorders = []
    this.streams = []
    this.pending = []
    await window.talkflow.recording.stop()
  }
}

export const recorder = new Recorder()
