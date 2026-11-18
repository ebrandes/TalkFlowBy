import { Check } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { ModelStatus } from '../../../shared/types'
import { useT } from '../i18n'

interface Perms {
  microphone: string
  screen: string
}

export function usePermissions(): [Perms | null, () => void] {
  const [perms, setPerms] = useState<Perms | null>(null)
  const refresh = useCallback(() => void window.talkflow.permissions.status().then(setPerms), [])
  useEffect(() => {
    refresh()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [refresh])
  return [perms, refresh]
}

function Done({ label }: { label: string }): React.JSX.Element {
  return (
    <span className="ok-mark">
      <Check size={15} strokeWidth={2} aria-hidden /> {label}
    </span>
  )
}

/** Linha do modelo de transcrição: pronto, baixando ou faltando. */
export function ModelLine({ model }: { model: ModelStatus }): React.JSX.Element {
  const t = useT().setup
  const pct = Math.round((model.progress ?? 0) * 100)
  return (
    <div className="set-row">
      <span className="set-label">
        <span>{t.model}</span>
        <span className="hint">{model.ready ? t.modelReady : (model.error ?? t.modelMissing)}</span>
      </span>
      {model.ready ? (
        <Done label={t.ready} />
      ) : model.downloading ? (
        <span className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <span className="progress-fill" style={{ width: `${pct}%` }} />
          <span className="progress-text">{pct}%</span>
        </span>
      ) : (
        <button className="btn" onClick={() => void window.talkflow.model.download()}>
          {t.download}
        </button>
      )}
    </div>
  )
}

/** Microfone e áudio da chamada no Mac. No Windows não há o que pedir. */
export function PermissionLines(): React.JSX.Element {
  const t = useT().setup
  const [perms, refresh] = usePermissions()
  if (!perms) return <></>
  return (
    <>
      <div className="set-row">
        <span className="set-label">
          <span>{t.microphone}</span>
          <span className="hint">{t.microphoneHint}</span>
        </span>
        {perms.microphone === 'granted' ? (
          <Done label={t.allowed} />
        ) : (
          <button
            className="btn"
            onClick={async () => {
              const ok = perms.microphone === 'not-determined' && (await window.talkflow.permissions.askMic())
              if (!ok) await window.talkflow.permissions.openSettings('microphone')
              refresh()
            }}
          >
            {t.allow}
          </button>
        )}
      </div>
      <div className="set-row">
        <span className="set-label">
          <span>{t.callAudio}</span>
          <span className="hint">{t.callAudioHint}</span>
        </span>
        {perms.screen === 'granted' ? (
          <Done label={t.allowed} />
        ) : (
          <button className="btn" onClick={() => void window.talkflow.permissions.openSettings('screen')}>
            {t.openSettings}
          </button>
        )}
      </div>
    </>
  )
}

/** Primeira abertura: o que falta para gravar, em uma frase cada. Some quando tudo está pronto. */
export function SetupCard({ model }: { model: ModelStatus }): React.JSX.Element | null {
  const t = useT().setup
  const [perms] = usePermissions()
  const isMac = window.talkflow.platform === 'darwin'
  const permsOk = !isMac || (perms?.microphone === 'granted' && perms?.screen === 'granted')
  if (model.ready && permsOk) return null
  return (
    <section className="setup" aria-label={t.title}>
      <h2>{t.title}</h2>
      {!model.ready && <ModelLine model={model} />}
      {isMac && !permsOk && <PermissionLines />}
    </section>
  )
}
