// Só em desenvolvimento, fora do Electron: imita a ponte do preload para revisar as telas no navegador.
// Conteúdo sintético, apenas para teste visual.
import { dict, type Lang } from '../../../shared/i18n'
import type { LibraryNode, Settings } from '../../../shared/types'

const params = new URLSearchParams(location.search)
const lang: Lang = params.get('lang') === 'en' ? 'en' : 'pt'
const F = dict(lang).folders
const sep = lang === 'en' ? '.' : 'h'

const files = new Map<string, string>()
const sample = `---
data: 2026-11-17 14:30
duracao: 42 min
origem: Google Meet (Chrome)
---

# Planejamento do canal em dezembro

> O time fechou o calendário de dezembro com oito vídeos, revisou o gasto com vozes e decidiu testar uma capa nova antes de mudar todas.

## Tópicos

### Calendário de dezembro

- Oito vídeos, dois por semana, começando no dia 2.
- Especial de fim de ano sai no dia 23.

### Orçamento de vozes

- A cota atual acaba no dia 20; os Shorts passam a usar voz local.

## Decisões

- Capa nova entra em teste com dois vídeos antes de virar padrão.

## Próximos passos

- [ ] Montar o roteiro do especial — Marina
- [ ] Medir a cota de voz até sexta

## Transcrição

**00:00 · Você:** Bom dia. Vamos fechar o calendário de dezembro. A minha proposta é publicar oito vídeos, dois por semana, começando no dia 2.

**00:11 · Outros:** Concordo com os oito vídeos. Mas a cota de vozes acaba no dia 20, então precisamos de um plano para os Shorts.
`
const sampleEn = `---
date: 2026-11-17 14:30
duration: 42 min
source: Google Meet (Chrome)
---

# Q4 launch plan

> The team agreed on a December 2 launch, moved the pricing page review to Friday and will test the new onboarding with five customers first.

## Topics

### Launch date

- Launch moves to December 2, after the payment provider migration.
- Press kit is due one week before.

### Onboarding

- New flow gets tested with five customers before the full rollout.

## Decisions

- Pricing page review happens before the press kit.

## Next steps

- [ ] Send the updated timeline to sales — Ana
- [ ] Book the five customer sessions

## Transcript

**00:00 · You:** Let's start with the launch date. The migration finishes on the 28th, so I'd like to move to December 2.

**00:11 · Others:** December 2 works for us. We still need the pricing page reviewed before the press kit goes out.
`
const titles = lang === 'en'
  ? ['Q4 launch plan', 'Payments squad sync', 'Packaging supplier call', 'Sprint review']
  : ['Planejamento do canal em dezembro', 'Alinhamento squad pagamentos', 'Fornecedor de embalagens', 'Revisão de sprint']
const base = lang === 'en' ? sampleEn : sample
const make = (title: string): string => base.replace(lang === 'en' ? 'Q4 launch plan' : 'Planejamento do canal em dezembro', title)
files.set(`${F.meetings}/2026/11/2026-11-17 14${sep}30 - ${titles[0]}.md`, make(titles[0]))
files.set(`${F.meetings}/2026/11/2026-11-14 10${sep}00 - ${titles[1]}.md`, make(titles[1]))
files.set(`${F.meetings}/2026/11/2026-11-12 16${sep}15 - ${titles[2]}.md`, make(titles[2]))
files.set(`${F.meetings}/2026/10/2026-10-28 09${sep}30 - ${titles[3]}.md`, make(titles[3]))
files.set(
  `${F.notes}/${lang === 'en' ? 'Loose ideas' : 'Ideias soltas'}.md`,
  lang === 'en' ? '# Loose ideas\n\n- Try a violet cover\n- Ask about the 2027 budget\n' : '# Ideias soltas\n\n- Testar capa com fundo violeta\n- Perguntar sobre orçamento de 2027\n'
)

function tree(): LibraryNode[] {
  const root: LibraryNode[] = []
  for (const path of [...files.keys()].sort().reverse()) {
    const parts = path.split('/')
    let level = root
    parts.forEach((part, i) => {
      const sub = parts.slice(0, i + 1).join('/')
      if (i === parts.length - 1) level.push({ kind: 'file', name: part.replace(/\.md$/, ''), path: sub })
      else {
        let folder = level.find((n) => n.path === sub)
        if (!folder) level.push((folder = { kind: 'folder', name: part, path: sub, children: [] }))
        level = folder.children!
      }
    })
  }
  return root
}

let settings: Settings = {
  rootDir: lang === 'en' ? '/Users/you/Documents/TalkFlowBy' : '/Users/voce/Documents/TalkFlowBy',
  uiLanguage: lang,
  folders: { ...F },
  language: lang,
  summaryProvider: 'auto',
  hasApiKey: false,
  keepAudio: false,
  detectMeetings: true,
  silenceStopMinutes: 5,
  transcriptionQuality: 'best',
  mutedApps: [],
  openAtLogin: true
}

const noop = (): (() => void) => () => undefined
const recording = params.has('rec')
const stage = params.get('stage')

window.talkflow = {
  platform: (params.get('platform') ?? 'darwin') as NodeJS.Platform,
  settings: {
    get: async () => settings,
    update: async (p) => (settings = { ...settings, ...p }),
    setApiKey: async (k) => (settings = { ...settings, hasApiKey: Boolean(k) })
  },
  library: {
    tree: async () => tree(),
    read: async (rel) => files.get(rel) ?? '',
    write: async (rel, c) => void files.set(rel, c),
    create: async (title = dict(lang).main.newNote) => {
      const rel = `${F.notes}/${title}.md`
      files.set(rel, `# ${title}\n\n`)
      return rel
    },
    rename: async (rel, title) => {
      const next = rel.replace(/[^/]+\.md$/, `${title}.md`)
      files.set(next, files.get(rel) ?? '')
      files.delete(rel)
      return next
    },
    trash: async (rel) => void files.delete(rel),
    trashMany: async (rels) => rels.filter((r) => files.delete(r)).length,
    reveal: async () => undefined,
    openRoot: async () => '',
    onChanged: noop
  },
  recording: {
    begin: async () => ({ id: 'x', startedAt: new Date().toISOString() }),
    chunk: () => undefined,
    stop: async () => undefined,
    autoStopped: async () => undefined,
    state: async () => ({ recording, startedAt: recording ? new Date(Date.now() - 767_000).toISOString() : null, origin: null }),
    onState: noop,
    onStartCommand: noop,
    onStopCommand: noop
  },
  pipeline: {
    status: async () => (stage ? { stage: stage as never, progress: 0.4, meeting: '17 nov 16:05' } : { stage: 'idle' }),
    onStatus: noop
  },
  model: {
    status: async () => (params.has('nomodel') ? { ready: false } : { ready: true, path: 'x' }),
    download: async () => undefined,
    onStatus: noop
  },
  permissions: {
    status: async () => ({ microphone: params.has('noperm') ? 'not-determined' : 'granted', screen: params.has('noperm') ? 'denied' : 'granted' }),
    askMic: async () => true,
    openSettings: async () => undefined
  },
  prompt: { answer: async () => undefined },
  window: { show: async () => undefined }
}
