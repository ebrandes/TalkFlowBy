import { useState } from 'react'
import { useT } from '../i18n'
import { SOUND_LEVEL } from '../silence'

type Result = 'ok' | 'silent' | 'blocked'

/** Maior volume (RMS) que a trilha teve durante `ms`. */
async function loudest(stream: MediaStream, ms: number): Promise<number> {
  const ctx = new AudioContext()
  const a = ctx.createAnalyser()
  a.fftSize = 2048
  ctx.createMediaStreamSource(stream).connect(a)
  const buf = new Float32Array(2048)
  let max = 0
  const end = Date.now() + ms
  while (Date.now() < end) {
    await new Promise((r) => setTimeout(r, 100))
    a.getFloatTimeDomainData(buf)
    let sum = 0
    for (const v of buf) sum += v * v
    max = Math.max(max, Math.sqrt(sum / buf.length))
  }
  await ctx.close()
  return max
}

/** Escuta microfone e áudio do computador por 5 s, sem gravar nada, e diz se o som chegou. */
export function AudioTest(): React.JSX.Element {
  const t = useT().settings
  const [running, setRunning] = useState(false)
  const [res, setRes] = useState<{ mic: Result; system: Result } | null>(null)

  const run = async (): Promise<void> => {
    setRunning(true)
    setRes(null)
    const streams: MediaStream[] = []
    const measure = async (get: () => Promise<MediaStream>, audioOnly: boolean): Promise<Result> => {
      try {
        const s = await get()
        streams.push(s)
        if (audioOnly) s.getVideoTracks().forEach((v) => v.stop())
        if (!s.getAudioTracks().length) return 'blocked'
        return (await loudest(new MediaStream(s.getAudioTracks()), 5000)) > SOUND_LEVEL ? 'ok' : 'silent'
      } catch {
        return 'blocked'
      }
    }
    const [mic, system] = await Promise.all([
      measure(() => navigator.mediaDevices.getUserMedia({ audio: true }), false),
      measure(() => navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 1 }, audio: true }), true)
    ])
    streams.forEach((s) => s.getTracks().forEach((tr) => tr.stop()))
    setRes({ mic, system })
    setRunning(false)
  }

  const label = (r: Result): string => (r === 'ok' ? t.audioOk : r === 'silent' ? t.audioSilent : t.audioBlocked)

  return (
    <div className="set-row">
      <span className="set-label">
        <span>{t.audioTest}</span>
        <span className="hint">{t.audioTestHint}</span>
        {res && (
          <span className="audio-result" role="status">
            <span className={res.mic === 'ok' ? 'ok-mark' : 'hint error'}>
              {t.audioMic}: {label(res.mic)}
            </span>
            <span className={res.system === 'ok' ? 'ok-mark' : 'hint error'}>
              {t.audioSystem}: {label(res.system)}
            </span>
          </span>
        )}
      </span>
      <button className="btn" onClick={() => void run()} disabled={running}>
        {running ? t.audioTestRunning : t.audioTestRun}
      </button>
    </div>
  )
}
