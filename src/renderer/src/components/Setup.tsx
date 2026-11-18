import { Check } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { ModelStatus } from '../../../shared/types'

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

/** Linha do modelo de transcrição: pronto, baixando ou faltando. */
export function ModelLine({ model }: { model: ModelStatus }): React.JSX.Element {
  if (model.ready) {
    return (
      <div className="set-row">
        <span className="set-label">
          <span>Modelo de transcrição</span>
          <span className="hint">Whisper large-v3-turbo, roda neste computador</span>
        </span>
        <span className="ok-mark">
          <Check size={15} strokeWidth={2} aria-hidden /> Pronto
        </span>
      </div>
    )
  }
  return (
    <div className="set-row">
      <span className="set-label">
        <span>Modelo de transcrição</span>
        <span className="hint">{model.error ?? 'Arquivo de 574 MB, baixado uma vez. A transcrição roda neste computador.'}</span>
      </span>
      {model.downloading ? (
        <span className="progress" role="progressbar" aria-valuenow={Math.round((model.progress ?? 0) * 100)} aria-valuemin={0} aria-valuemax={100}>
          <span className="progress-fill" style={{ width: `${(model.progress ?? 0) * 100}%` }} />
          <span className="progress-text">{Math.round((model.progress ?? 0) * 100)}%</span>
        </span>
      ) : (
        <button className="btn" onClick={() => void window.talkflow.model.download()}>
          Baixar
        </button>
      )}
    </div>
  )
}

/** Microfone e áudio da chamada no Mac. No Windows não há o que pedir. */
export function PermissionLines(): React.JSX.Element {
  const [perms, refresh] = usePermissions()
  if (!perms) return <></>
  return (
    <>
      <div className="set-row">
        <span className="set-label">
          <span>Microfone</span>
          <span className="hint">Para gravar a sua voz</span>
        </span>
        {perms.microphone === 'granted' ? (
          <span className="ok-mark">
            <Check size={15} strokeWidth={2} aria-hidden /> Liberado
          </span>
        ) : (
          <button
            className="btn"
            onClick={async () => {
              const ok = perms.microphone === 'not-determined' && (await window.talkflow.permissions.askMic())
              if (!ok) await window.talkflow.permissions.openSettings('microphone')
              refresh()
            }}
          >
            Liberar
          </button>
        )}
      </div>
      <div className="set-row">
        <span className="set-label">
          <span>Áudio da chamada</span>
          <span className="hint">O macOS chama de “Gravação de Tela”. Nenhuma imagem é gravada.</span>
        </span>
        {perms.screen === 'granted' ? (
          <span className="ok-mark">
            <Check size={15} strokeWidth={2} aria-hidden /> Liberado
          </span>
        ) : (
          <button className="btn" onClick={() => void window.talkflow.permissions.openSettings('screen')}>
            Abrir ajustes
          </button>
        )}
      </div>
    </>
  )
}

/** Primeira abertura: o que falta para gravar, em uma frase cada. Some quando tudo está pronto. */
export function SetupCard({ model }: { model: ModelStatus }): React.JSX.Element | null {
  const [perms] = usePermissions()
  const isMac = window.talkflow.platform === 'darwin'
  const permsOk = !isMac || (perms?.microphone === 'granted' && perms?.screen === 'granted')
  if (model.ready && permsOk) return null
  return (
    <section className="setup" aria-label="Preparação">
      <h2>Antes da primeira gravação</h2>
      {!model.ready && <ModelLine model={model} />}
      {isMac && !permsOk && <PermissionLines />}
    </section>
  )
}
