import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { LANGS, type Lang } from '../../../shared/i18n'
import type { ModelStatus, Settings as S, SummaryProvider, SyncStatus } from '../../../shared/types'
import { useT } from '../i18n'
import { KNOWN_APP_NAMES } from '../lib/apps'
import { ModelLine, PermissionLines } from './Setup'
import { AudioTest } from './AudioTest'
import { SHORTCUTS, shortcutLabel } from '../../../shared/shortcuts'

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

        <SyncSection settings={settings} onChange={onChange} />

        <section className="set-group">
          <h2>{t.meetings}</h2>
          <Toggle label={t.ask} hint={t.askHint} checked={settings.detectMeetings} onChange={(v) => void update({ detectMeetings: v })} />
          {settings.detectMeetings && (
            <Toggle label={t.autoRecord} hint={t.autoRecordHint} checked={settings.autoRecord} onChange={(v) => void update({ autoRecord: v })} />
          )}
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
          <Toggle
            label={t.liveTranscription}
            hint={t.liveTranscriptionHint}
            checked={settings.liveTranscription}
            onChange={(v) => void update({ liveTranscription: v })}
          />
          <Toggle
            label={t.separateVoices}
            hint={t.separateVoicesHint}
            checked={settings.separateVoices}
            onChange={(v) => void update({ separateVoices: v })}
          />
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

        <section className="set-group">
          <h2>{window.talkflow.platform === 'darwin' ? t.permissions : t.audioTest}</h2>
          {window.talkflow.platform === 'darwin' && <PermissionLines />}
          <AudioTest />
        </section>

        <section className="set-group">
          <h2>{t.shortcuts}</h2>
          {shortcutRows(t, window.talkflow.platform).map(([label, keys]) => (
            <div className="set-row" key={label}>
              <span className="set-label">
                <span>{label}</span>
              </span>
              <kbd className="kbd">{keys}</kbd>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}

function SyncSection({ settings, onChange }: { settings: S; onChange: (s: S) => void }): React.JSX.Element {
  const t = useT().settings
  const [remote, setRemote] = useState(settings.syncRemote)
  const [status, setStatus] = useState<SyncStatus>({ state: 'off' })
  useEffect(() => {
    void window.talkflow.sync.status().then(setStatus)
    return window.talkflow.sync.onStatus(setStatus)
  }, [])
  const connected = Boolean(settings.syncRemote)
  const save = async (value: string): Promise<void> => onChange(await window.talkflow.settings.update({ syncRemote: value.trim() }))
  const when = status.lastSync ? new Date(status.lastSync).toLocaleTimeString(settings.uiLanguage === 'pt' ? 'pt-BR' : 'en', { hour: '2-digit', minute: '2-digit' }) : null
  const line =
    !connected ? t.syncOff
    : status.state === 'syncing' ? t.syncing
    : status.state === 'error' ? t.syncFailed(t.syncErrors[status.error ?? ''] ?? status.error ?? '')
    : when ? t.syncedAt(when)
    : t.syncing

  return (
    <section className="set-group">
      <h2>{t.sync}</h2>
      <div className="set-row stack">
        <label className="set-label" htmlFor="sync-remote">
          <span>{t.syncRemote}</span>
          <span className="hint">{t.syncHint}</span>
        </label>
        <div className="key-row">
          <input
            id="sync-remote"
            className="field"
            placeholder={t.syncPlaceholder}
            value={remote}
            onChange={(e) => setRemote(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <button className="btn" disabled={!remote.trim() || remote.trim() === settings.syncRemote} onClick={() => void save(remote)}>
            {t.syncConnect}
          </button>
          {connected && (
            <button
              className="btn ghost"
              onClick={async () => {
                setRemote('')
                await save('')
              }}
            >
              {t.syncDisconnect}
            </button>
          )}
        </div>
        <span className={status.state === 'error' && connected ? 'hint error' : 'hint'} role="status">
          {line}
        </span>
        {connected && status.conflicts ? <span className="hint">{t.syncConflicts(status.conflicts)}</span> : null}
        {connected && status.backup && <span className="hint">{t.syncBackup}</span>}
      </div>
      {connected && (
        <div className="btn-pair">
          <button className="btn" disabled={status.state === 'syncing'} onClick={() => void window.talkflow.sync.now()}>
            {t.syncNow}
          </button>
          {status.backup && (
            <button className="btn ghost" onClick={() => void window.talkflow.sync.openBackup()}>
              {t.openBackup}
            </button>
          )}
        </div>
      )}
    </section>
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

function shortcutRows(t: ReturnType<typeof useT>['settings'], platform: string): [string, string][] {
  const mod = platform === 'darwin' ? '⌘' : 'Ctrl+'
  return [
    [t.shortcutRecord, shortcutLabel(SHORTCUTS.record, platform)],
    [t.shortcutCapture, shortcutLabel(SHORTCUTS.capture, platform)],
    [t.shortcutNewNote, `${mod}N`],
    [t.shortcutFind, `${mod}K`],
    [t.shortcutFindInNote, `${mod}F`],
    [t.shortcutCopyMd, platform === 'darwin' ? '⌘⇧C' : 'Ctrl+Shift+C'],
    [t.shortcutAsk, `${mod}J`],
    [t.shortcutSettings, `${mod},`]
  ]
}
