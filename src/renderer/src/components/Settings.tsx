import { X } from 'lucide-react'
import { useState } from 'react'
import type { ModelStatus, Settings as S, SummaryProvider } from '../../../shared/types'
import { KNOWN_APP_NAMES } from '../lib/apps'
import { ModelLine, PermissionLines } from './Setup'

interface Props {
  settings: S
  model: ModelStatus
  onChange: (s: S) => void
  onClose: () => void
}

const PROVIDERS: { value: SummaryProvider; label: string }[] = [
  { value: 'auto', label: 'Assinatura do Claude; chave de API como reserva' },
  { value: 'claude-cli', label: 'Só a assinatura do Claude (Claude Code)' },
  { value: 'api', label: 'Só a chave de API' }
]

export function SettingsView({ settings, model, onChange, onClose }: Props): React.JSX.Element {
  const [key, setKey] = useState('')
  const [keyError, setKeyError] = useState<string | null>(null)
  const update = async (patch: Partial<S>): Promise<void> => onChange(await window.talkflow.settings.update(patch))

  return (
    <div className="doc">
      <div className="doc-col settings">
        <div className="settings-head">
          <h1>Configurações</h1>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar configurações" title="Fechar">
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <section className="set-group">
          <h2>Notas</h2>
          <div className="set-row">
            <div className="set-label">
              <span>Pasta</span>
              <code className="path">{settings.rootDir}</code>
            </div>
            <button className="btn" onClick={() => void window.talkflow.library.openRoot()}>
              Abrir
            </button>
          </div>
        </section>

        <section className="set-group">
          <h2>Reuniões</h2>
          <Toggle label="Perguntar se quero gravar quando entro numa reunião" hint="Teams e Google Meet no navegador" checked={settings.detectMeetings} onChange={(v) => void update({ detectMeetings: v })} />
          {settings.mutedApps.length > 0 && (
            <div className="set-row">
              <div className="set-label">
                <span>Não pergunta mais para</span>
                <span className="hint">{settings.mutedApps.map((id) => KNOWN_APP_NAMES[id] ?? id).join(', ')}</span>
              </div>
              <button className="btn" onClick={() => void update({ mutedApps: [] })}>
                Voltar a perguntar
              </button>
            </div>
          )}
          <Toggle label="Guardar o áudio depois de transcrever" hint="Desligado, o áudio é apagado quando a nota fica pronta" checked={settings.keepAudio} onChange={(v) => void update({ keepAudio: v })} />
          <Toggle label="Abrir junto com o computador" hint="Fica na bandeja, pronto para perguntar" checked={settings.openAtLogin} onChange={(v) => void update({ openAtLogin: v })} />
        </section>

        <section className="set-group">
          <h2>Transcrição</h2>
          <ModelLine model={model} />
          <div className="set-row">
            <label className="set-label" htmlFor="lang">
              <span>Idioma das reuniões</span>
            </label>
            <select id="lang" className="field select" value={settings.language} onChange={(e) => void update({ language: e.target.value })}>
              <option value="pt">Português</option>
              <option value="en">Inglês</option>
              <option value="es">Espanhol</option>
              <option value="auto">Detectar sozinho</option>
            </select>
          </div>
        </section>

        <section className="set-group">
          <h2>Resumo</h2>
          <div className="set-row stack">
            <label className="set-label" htmlFor="provider">
              <span>Quem resume</span>
              <span className="hint">Modelo Claude Haiku</span>
            </label>
            <select id="provider" className="field select" value={settings.summaryProvider} onChange={(e) => void update({ summaryProvider: e.target.value as SummaryProvider })}>
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="set-row stack">
            <label className="set-label" htmlFor="apikey">
              <span>Chave de API da Anthropic</span>
              <span className="hint">{settings.hasApiKey ? 'Chave salva no cofre do sistema.' : 'Opcional se o Claude Code estiver instalado.'}</span>
            </label>
            <div className="key-row">
              <input id="apikey" className="field" type="password" placeholder={settings.hasApiKey ? '••••••••••••' : 'sk-ant-…'} value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" />
              <button
                className="btn"
                disabled={!key.trim()}
                onClick={async () => {
                  setKeyError(null)
                  try {
                    onChange(await window.talkflow.settings.setApiKey(key))
                    setKey('')
                  } catch (err) {
                    setKeyError((err as Error).message)
                  }
                }}
              >
                Salvar
              </button>
              {settings.hasApiKey && (
                <button className="btn ghost" onClick={async () => onChange(await window.talkflow.settings.setApiKey(null))}>
                  Remover
                </button>
              )}
            </div>
            {keyError && <span className="hint error">{keyError}</span>}
          </div>
        </section>

        {window.talkflow.platform === 'darwin' && (
          <section className="set-group">
            <h2>Permissões do Mac</h2>
            <PermissionLines />
          </section>
        )}
      </div>
    </div>
  )
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }): React.JSX.Element {
  return (
    <label className="set-row toggle-row">
      <span className="set-label">
        <span>{label}</span>
        {hint && <span className="hint">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}
