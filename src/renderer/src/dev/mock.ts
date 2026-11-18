// Só em desenvolvimento, fora do Electron: imita a ponte do preload para revisar as telas no navegador.
// Conteúdo sintético, apenas para teste visual.
import type { LibraryNode, Settings } from '../../../shared/types'

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

**[00:00] Você:** Bom dia. Vamos fechar o calendário de dezembro. A minha proposta é publicar oito vídeos, dois por semana, começando no dia 2.

**[00:11] Outros:** Concordo com os oito vídeos. Mas a cota de vozes acaba no dia 20, então precisamos de um plano para os Shorts.
`
files.set('Reuniões/2026/11/2026-11-17 14h30 - Planejamento do canal em dezembro.md', sample)
files.set('Reuniões/2026/11/2026-11-14 10h00 - Alinhamento squad pagamentos.md', sample.replace('Planejamento do canal em dezembro', 'Alinhamento squad pagamentos'))
files.set('Reuniões/2026/11/2026-11-12 16h15 - Fornecedor de embalagens.md', sample.replace('Planejamento do canal em dezembro', 'Fornecedor de embalagens'))
files.set('Reuniões/2026/10/2026-10-28 09h30 - Revisão de sprint.md', sample.replace('Planejamento do canal em dezembro', 'Revisão de sprint'))
files.set('Notas/Ideias soltas.md', '# Ideias soltas\n\n- Testar capa com fundo violeta\n- Perguntar sobre orçamento de 2027\n')

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
  rootDir: '/Users/voce/Documents/TalkFlowBy',
  language: 'pt',
  summaryProvider: 'auto',
  hasApiKey: false,
  keepAudio: false,
  detectMeetings: true,
  mutedApps: [],
  openAtLogin: true
}

const noop = (): (() => void) => () => undefined
const params = new URLSearchParams(location.search)
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
    create: async (title = 'Nova nota') => {
      const rel = `Notas/${title}.md`
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
    reveal: async () => undefined,
    openRoot: async () => '',
    onChanged: noop
  },
  recording: {
    begin: async () => ({ id: 'x', startedAt: new Date().toISOString() }),
    chunk: () => undefined,
    stop: async () => undefined,
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
