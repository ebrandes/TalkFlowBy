import { X } from 'lucide-react'
import { useState } from 'react'
import { LANGS, type Lang } from '../../../shared/i18n'
import type { ModelStatus, Settings as S, SummaryProvider } from '../../../shared/types'
import { useT } from '../i18n'
import { KNOWN_APP_NAMES } from '../lib/apps'
import { ModelLine, PermissionLines } from './Setup'

interface Props {
  settings: S
  model: ModelStatus
  onChange: (s: S) => void
  onClose: () => void
}

export function SettingsView({ settings, model, onChange, onClose }: Props): React.JSX.Element {
  const t = useT().settings
  const [key, setKey] = useState('')
  const [keyError, setKeyError] = useState<string | null>(null)
  const update = async (patch: Partial<S>): Promise<void> => onChange(await window.talkflow.settings.update(patch))
  const providers: { value: SummaryProvider; label: string }[] = [
    { value: 'auto', label: t.providerAuto },
    { value: 'claude-cli', label: t.providerCli },
    { value: 'api', label: t.providerApi }
  ]

  return (
    <div className="doc">
      <div className="doc-col settings">
        <div className="settings-head">
          <h1>{t.title}</h1>
          <button className="icon-btn" onClick={onClose} aria-label={t.close} title={t.close}>
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <section className="set-group">
          <h2>{t.general}</h2>
          <div className="set-row">
            <label className="set-label" htmlFor="ui-lang">
              <span>{t.appLanguage}</span>
            </label>
            <select id="ui-lang" className="field select" value={settings.uiLanguage} onChange={(e) => void update({ uiLanguage: e.target.value as Lang })}>
              {LANGS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div className="set-row">
            <div className="set-label">
              <span>{t.folder}</span>
              <code className="path">{settings.rootDir}</code>
              <span className="hint">{t.folderHint}</span>
            </div>
            <div className="btn-pair">
              <button className="btn" onClick={() => void window.talkflow.library.openRoot()}>
                {t.open}
              </button>
              <button className="btn" onClick={async () => onChange(await window.talkflow.library.chooseRoot())}>
                {t.change}
              </button>
            </div>
          </div>
        </section>

        <section className="set-group">
          <h2>{t.meetings}</h2>
          <Toggle label={t.ask} hint={t.askHint} checked={settings.detectMeetings} onChange={(v) => void update({ detectMeetings: v })} />
          {settings.mutedApps.length > 0 && (
            <div className="set-row">
              <div className="set-label">
                <span>{t.muted}</span>
                <span className="hint">{settings.mutedApps.map((id) => KNOWN_APP_NAMES[id] ?? id).join(', ')}</span>
              </div>
              <button className="btn" onClick={() => void update({ mutedApps: [] })}>
                {t.askAgain}
              </button>
            </div>
          )}
          <div className="set-row">
            <label className="set-label" htmlFor="silence">
              <span>{t.silenceStop}</span>
              <span className="hint">{t.silenceStopHint}</span>
            </label>
            <select id="silence" className="field select" value={settings.silenceStopMinutes} onChange={(e) => void update({ silenceStopMinutes: Number(e.target.value) })}>
              {[2, 5, 10, 15, 30].map((n) => (
                <option key={n} value={n}>
                  {t.minutes(n)}
                </option>
              ))}
              <option value={0}>{t.silenceNever}</option>
            </select>
          </div>
          <Toggle label={t.drawFlows} hint={t.drawFlowsHint} checked={settings.drawFlows} onChange={(v) => void update({ drawFlows: v })} />
          <Toggle label={t.keepAudio} hint={t.keepAudioHint} checked={settings.keepAudio} onChange={(v) => void update({ keepAudio: v })} />
          <Toggle label={t.checkUpdates} hint={t.checkUpdatesHint} checked={settings.checkUpdates} onChange={(v) => void update({ checkUpdates: v })} />
          <Toggle label={t.openAtLogin} hint={t.openAtLoginHint} checked={settings.openAtLogin} onChange={(v) => void update({ openAtLogin: v })} />
        </section>

        <section className="set-group">
          <h2>{t.transcription}</h2>
          <div className="set-row">
            <label className="set-label" htmlFor="quality">
              <span>{t.quality}</span>
              <span className="hint">{t.qualityHint}</span>
            </label>
            <select
              id="quality"
              className="field select"
              value={settings.transcriptionQuality}
              onChange={(e) => void update({ transcriptionQuality: e.target.value as S['transcriptionQuality'] })}
            >
              <option value="best">{t.qualityBest}</option>
              <option value="balanced">{t.qualityBalanced}</option>
              <option value="fast">{t.qualityFast}</option>
            </select>
          </div>
          <ModelLine model={model} quality={settings.transcriptionQuality} />
          <div className="set-row">
            <label className="set-label" htmlFor="lang">
              <span>{t.meetingLanguage}</span>
            </label>
            <select id="lang" className="field select" value={settings.language} onChange={(e) => void update({ language: e.target.value })}>
              <option value="en">{t.langEn}</option>
              <option value="pt">{t.langPt}</option>
              <option value="es">{t.langEs}</option>
              <option value="auto">{t.langAuto}</option>
            </select>
          </div>
        </section>

        <section className="set-group">
          <h2>{t.summary}</h2>
          <div className="set-row stack">
            <label className="set-label" htmlFor="provider">
              <span>{t.whoSummarizes}</span>
              <span className="hint">{t.modelHint}</span>
            </label>
            <select id="provider" className="field select" value={settings.summaryProvider} onChange={(e) => void update({ summaryProvider: e.target.value as SummaryProvider })}>
              {providers.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="set-row stack">
            <label className="set-label" htmlFor="apikey">
              <span>{t.apiKey}</span>
              <span className="hint">{settings.hasApiKey ? t.keySaved : t.keyOptional}</span>
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
                {t.save}
              </button>
              {settings.hasApiKey && (
                <button className="btn ghost" onClick={async () => onChange(await window.talkflow.settings.setApiKey(null))}>
                  {t.remove}
                </button>
              )}
            </div>
            {keyError && <span className="hint error">{keyError}</span>}
          </div>
        </section>

        {window.talkflow.platform === 'darwin' && (
          <section className="set-group">
            <h2>{t.permissions}</h2>
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
