// Textos em português do Brasil. Mesmo formato do `en.ts`.
import type { Dict } from './en'

export const pt: Dict = {
  months: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
  monthsLong: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],

  folders: { meetings: 'Reuniões', notes: 'Notas' },

  rail: {
    tasks: 'Pendências',
    pinned: 'Fixadas',
    emptyTasks: 'As pendências abertas das reuniões e notas aparecem aqui.',
    newNote: 'Nova nota',
    settings: 'Configurações',
    search: 'Buscar nas notas',
    meetings: 'Reuniões',
    notes: 'Notas',
    range: 'Intervalo listado',
    nothingFound: (q) => `Nada encontrado para “${q}”.`,
    emptyMeetings: 'As reuniões gravadas aparecem aqui, organizadas por mês.',
    emptyNotes: 'Notas soltas ficam aqui.',
    createFirst: 'Criar a primeira'
  },

  bar: {
    eta: (min) => (min <= 1 ? 'falta ~1 min' : `faltam ~${min} min`),
    queued: (n) => (n === 1 ? 'mais 1 na fila' : `mais ${n} na fila`),
    record: 'Gravar',
    starting: 'Iniciando…',
    stop: 'Parar',
    recording: 'Gravando',
    paused: 'Pausado',
    pause: 'Pausar',
    resume: 'Continuar',
    transcribing: 'Transcrevendo',
    summarizing: 'Resumindo',
    summarized: 'Resumido',
    recordingOf: (when) => `Gravação ${when}`,
    savedNoSummary: (when) => `Gravação de ${when} salva sem resumo`,
    processingError: 'Algo deu errado ao processar a gravação.',
    missingModel: 'Falta o modelo de transcrição'
  },

  note: {
    pin: 'Fixar no topo da lista',
    unpin: 'Desafixar',
    renameSpeaker: 'Dar nome a “Outros”',
    renameSpeakerTitle: 'Quem é “Outros” nesta reunião?',
    renameSpeakerHint: 'Troca “Outros” por este nome em toda a transcrição.',
    renameSpeakerPlaceholder: 'Nome',
    renameSpeakerApply: 'Trocar',
    trashed: (n) => (n === 1 ? 'Nota mandada para a Lixeira' : `${n} notas mandadas para a Lixeira`),
    undo: 'Desfazer',
    restored: 'Restaurada',
    resummarize: 'Gerar resumo de novo',
    resummarizing: 'Resumindo…',
    resummarized: 'Resumo atualizado',
    changedOutside: 'Esta nota mudou fora do TalkFlowBy e foi recarregada.',
    summarized: 'Resumido',
    noSummary: 'Sem resumo',
    openError: 'Não foi possível abrir esta nota. Ela pode ter sido movida ou apagada.',
    reveal: 'Mostrar o arquivo na pasta',
    trash: 'Mover para a Lixeira',
    fileName: 'Nome do arquivo',
    rename: 'Clique para renomear o arquivo',
    share: 'Enviar ou copiar',
    copyNote: 'Copiar nota (Markdown)',
    copyTranscript: 'Copiar transcrição',
    openClaude: 'Abrir no Claude',
    copied: 'Copiado',
    copiedForClaude: 'Nota copiada. Se ela não aparecer no Claude, cole com Ctrl+V ou ⌘V.',
    noTranscript: 'Esta nota não tem transcrição.',
    copyMarkdown: 'Copiar Markdown (Ctrl+Shift+C / ⌘⇧C)',
    copiedMarkdown: 'Markdown da nota copiado'
  },

  find: {
    placeholder: 'Buscar na nota',
    count: (i, n) => `${i} de ${n}`,
    none: 'Nada encontrado',
    prev: 'Anterior (Shift+Enter)',
    next: 'Próximo (Enter)',
    close: 'Fechar (Esc)'
  },

  confirm: {
    trashOne: 'Mover esta nota para a Lixeira?',
    trashMany: (n) => `Mover ${n} notas para a Lixeira?`,
    trashHint: 'Dá para recuperar pela Lixeira do sistema.',
    cancel: 'Cancelar',
    trash: 'Mover para a Lixeira'
  },

  select: {
    start: 'Selecionar notas',
    done: 'Concluir',
    count: (n) => (n === 1 ? '1 selecionada' : `${n} selecionadas`),
    all: 'Selecionar todas',
    none: 'Limpar seleção',
    trash: 'Mover para a Lixeira'
  },

  ask: {
    open: 'Perguntar ao Claude sobre as notas',
    openNote: 'Perguntar ao Claude sobre esta nota',
    title: 'Pergunte às suas notas',
    shortcut: (key) => `${key}+J`,
    scopeNote: 'Esta nota',
    scopeAll: 'Todas as notas',
    placeholder: 'Por exemplo: liste os repositórios conversados nesta conversa',
    submit: 'Perguntar',
    thinking: 'Lendo as notas…',
    copy: 'Copiar resposta (Markdown)',
    copied: 'Resposta copiada',
    sources: 'Fontes',
    noSources: 'A resposta não citou nenhuma nota.',
    partial: (omitted, trimmed) =>
      [omitted ? `${omitted} ${omitted === 1 ? 'nota mais antiga ficou' : 'notas mais antigas ficaram'} de fora` : '', trimmed ? `${trimmed} ${trimmed === 1 ? 'foi' : 'foram'} sem a transcrição` : '']
        .filter(Boolean)
        .join(', ') + ' para caber.',
    failed: 'Não foi possível obter uma resposta.',
    setupHint: 'A pesquisa inteligente usa o mesmo Claude dos resumos: o Claude Code conectado ou uma chave de API nas Configurações.',
    close: 'Fechar',
    examples: {
      note: ['Liste os repositórios conversados nesta conversa', 'Quais tarefas ficaram comigo?', 'Quais decisões foram tomadas, e por quê?'],
      all: ['Quais repositórios apareceram nas minhas reuniões deste mês?', 'Quais são minhas tarefas abertas em todas as reuniões?', 'Quando falamos do orçamento pela última vez?']
    }
  },

  welcome: {
    recordingTitle: 'Gravando a reunião',
    recordingLead: 'Pode seguir na chamada. Quando parar, a transcrição e o resumo aparecem na lista em alguns minutos.',
    idleTitle: 'Nenhuma reunião aberta',
    idleLead: 'Clique em Gravar no topo, ou responda Gravar no aviso que aparece quando você entra no Teams ou no Google Meet.',
    how1: 'Grava a sua voz e o áudio da chamada, sem robô entrando na reunião.',
    how2: 'Transcreve neste computador, separando você dos outros.',
    how3: 'O Claude Haiku organiza em resumo, decisões e próximos passos.',
    notesTitle: 'Nenhuma nota aberta',
    notesLead: 'Escolha uma nota na lista ou comece uma nova. Digite / dentro da nota para inserir títulos, listas e tarefas.',
    newNote: 'Nova nota'
  },

  setup: {
    title: 'Antes da primeira gravação',
    model: 'Modelo de transcrição',
    modelReady: (name) => `${name}, roda neste computador`,
    modelMissing: (mb) => `Arquivo de ${mb} MB, baixado uma vez. A transcrição roda neste computador.`,
    ready: 'Pronto',
    download: 'Baixar',
    microphone: 'Microfone',
    microphoneHint: 'Para gravar a sua voz',
    callAudio: 'Áudio da chamada',
    callAudioHint: 'O macOS chama de “Gravação de Tela e Áudio do Sistema”. Nenhuma imagem é gravada.',
    allowed: 'Liberado',
    allow: 'Liberar',
    openSettings: 'Abrir ajustes'
  },

  settings: {
    shortcuts: 'Atalhos de teclado',
    shortcutRecord: 'Começar ou parar a gravação (funciona com o app em segundo plano)',
    shortcutCapture: 'Capturar a tela durante a gravação (funciona com o app em segundo plano)',
    shortcutNewNote: 'Nova nota',
    shortcutSettings: 'Configurações',
    shortcutFind: 'Buscar nas notas',
    audioTest: 'Testar áudio',
    audioTestHint: 'Escuta por 5 segundos para conferir se o microfone e o áudio do computador estão chegando. Toque algo e fale umas palavras.',
    audioTestRun: 'Testar',
    audioTestRunning: 'Escutando…',
    audioMic: 'Microfone',
    audioSystem: 'Áudio do computador',
    audioOk: 'Som chegando',
    audioSilent: 'Sem som',
    audioBlocked: 'Não liberado',
    title: 'Configurações',
    close: 'Fechar configurações',
    general: 'Geral',
    appLanguage: 'Idioma do app',
    notes: 'Notas',
    folder: 'Pasta',
    folderHint: 'Pode apontar para o seu vault do Obsidian. As notas já salvas continuam onde estão.',
    open: 'Abrir',
    change: 'Trocar…',
    meetings: 'Reuniões',
    ask: 'Perguntar se quero gravar quando entro numa reunião',
    askHint: 'Teams e Google Meet no navegador',
    muted: 'Não pergunta mais para',
    askAgain: 'Voltar a perguntar',
    liveTranscription: 'Transcrever durante a reunião',
    liveTranscriptionHint: 'A nota fica pronta logo depois do fim. Usa metade do processador enquanto você está na chamada',
    keepAudio: 'Guardar o áudio depois de transcrever',
    keepAudioHint: 'Desligado, o áudio é apagado quando a nota fica pronta',
    drawFlows: 'Desenhar o fluxo',
    drawFlowsHint: 'Quando a reunião descreve um processo, um diagrama vai no fim da nota',
    silenceStop: 'Parar depois de silêncio',
    silenceStopHint: 'Encerra a gravação quando ninguém fala por um tempo',
    silenceNever: 'Nunca',
    minutes: (n) => `${n} minutos`,
    checkUpdates: 'Procurar atualizações',
    checkUpdatesHint: 'Procura versão nova no GitHub a cada poucas horas',
    openAtLogin: 'Abrir junto com o computador',
    openAtLoginHint: 'Fica na bandeja, pronto para perguntar',
    transcription: 'Transcrição',
    quality: 'Qualidade da transcrição',
    qualityHint: 'Modelos menores são bem mais rápidos em computadores sem placa de vídeo',
    qualityBest: 'Melhor (574 MB)',
    qualityBalanced: 'Equilibrada, cerca de 4x mais rápida (190 MB)',
    qualityFast: 'Mais rápida, cerca de 6x mais rápida (60 MB)',
    meetingLanguage: 'Idioma das reuniões',
    langPt: 'Português',
    langEn: 'Inglês',
    langEs: 'Espanhol',
    langAuto: 'Detectar sozinho',
    summary: 'Resumo',
    whoSummarizes: 'Quem resume',
    modelHint: 'Modelo Claude Haiku',
    providerAuto: 'Assinatura do Claude; chave de API como reserva',
    providerCli: 'Só a assinatura do Claude (Claude Code)',
    providerApi: 'Só a chave de API',
    apiKey: 'Chave de API da Anthropic',
    keySaved: 'Chave salva no cofre do sistema.',
    keyOptional: 'Opcional se o Claude Code estiver instalado.',
    save: 'Salvar',
    remove: 'Remover',
    permissions: 'Permissões do Mac'
  },

  recorder: {
    micOnly: 'Só o seu microfone está sendo gravado. Libere o áudio da chamada nas configurações do sistema.',
    failed: (msg) => `Não foi possível gravar: ${msg}`
  },

  widget: {
    recording: 'Gravando',
    paused: 'Pausado',
    pause: 'Pausar',
    resume: 'Continuar',
    stop: 'Encerrar e salvar',
    move: 'Arraste para mover',
    capture: 'Capturar tela',
    captures: (n) => (n === 1 ? '1 tela capturada' : `${n} telas capturadas`),
    captureFailed: 'Não foi possível capturar a tela.',
    captureNoPermission: 'Não foi possível capturar a tela. Libere "Gravação de Tela e Áudio do Sistema" para o TalkFlowBy nos Ajustes do Sistema.'
  },

  prompt: {
    title: 'Gravar esta reunião?',
    desc: (app) => `Reunião no ${app}. Lembre de avisar os participantes.`,
    close: 'Fechar',
    record: 'Gravar'
  },

  editor: {
    placeholder: 'Escreva aqui, ou digite / para inserir um bloco',
    bold: 'Negrito',
    italic: 'Itálico',
    strike: 'Riscado',
    code: 'Código',
    link: 'Link',
    linkPlaceholder: 'Cole ou digite o endereço',
    text: 'Texto',
    paragraph: 'Parágrafo',
    h1: 'Título grande',
    h2: 'Título médio',
    h3: 'Título pequeno',
    quote: 'Citação',
    divider: 'Divisória',
    lists: 'Listas',
    bullet: 'Lista',
    ordered: 'Lista numerada',
    task: 'Tarefas',
    uploadImage: 'Enviar imagem',
    imageLink: 'ou cole o link de uma imagem',
    imageCaption: 'Adicionar legenda'
  },

  autoStop: {
    lowDisk: (gb) => `Só ${gb} GB livres no disco. Uma gravação longa pode não caber.`,
    meetingEnded: (app) => `Gravação encerrada: a chamada no ${app} terminou. A nota fica pronta em alguns minutos.`,
    silence: (min) => `Gravação encerrada depois de ${min} minutos de silêncio. A nota fica pronta em alguns minutos.`,
    recovered: (n) => (n === 1 ? 'Uma gravação interrompida foi recuperada e está sendo processada.' : `${n} gravações interrompidas foram recuperadas e estão sendo processadas.`)
  },

  update: {
    available: (v) => `Versão ${v} disponível`,
    ready: (v) => `Versão ${v} pronta`,
    download: 'Baixar',
    restart: 'Reiniciar para atualizar'
  },

  tray: {
    open: 'Abrir TalkFlowBy',
    record: 'Gravar reunião',
    stop: 'Parar gravação',
    quit: 'Sair',
    recordingTip: 'TalkFlowBy — gravando'
  },

  errors: {
    whisper: 'A transcrição falhou. Tente de novo; se continuar, escolha uma qualidade mais leve nas Configurações.',
    ffmpeg: 'Não deu para ler o áudio gravado. O áudio ficou guardado e dá para tentar de novo.',
    summaryTimeout: 'O resumo demorou demais e foi cancelado. Use “Gerar resumo de novo” na nota.',
    noProvider: 'Sem como resumir: instale o Claude Code ou salve uma chave da API da Anthropic nas Configurações.',
    offline: 'Sem internet para resumir. Use “Gerar resumo de novo” na nota quando a conexão voltar.',
    claude: 'O Claude não conseguiu resumir esta reunião. Use “Gerar resumo de novo” na nota.',
    generic: (detail) => `Algo deu errado: ${detail}`,
    summaryNotGenerated: (reason) => `Nota salva sem resumo. ${reason}`
  },

  failed: {
    title: (n) => (n === 1 ? 'Uma gravação não pôde ser processada' : `${n} gravações não puderam ser processadas`),
    lead: 'O áudio está guardado. Tente de novo ou mande para a Lixeira.',
    retry: 'Tentar de novo',
    discard: 'Mandar para a Lixeira',
    when: (date, min) => `${date} · ${min} min`
  },

  main: {
    missingWhisper: 'Transcrição indisponível: falta o Whisper ou o modelo. O áudio ficou guardado.',
    newNote: 'Nova nota',
    untitled: 'Sem título',
    stillInTray: 'O TalkFlowBy continua na bandeja do sistema, pronto para perguntar quando uma reunião começar. Clique com o botão direito no ícone para sair.'
  },

  doc: {
    you: 'Você',
    others: 'Outros',
    keys: { date: 'data', duration: 'duracao', source: 'origem' },
    untitled: 'Reunião sem assunto',
    fileSubject: 'Reunião',
    topics: 'Tópicos',
    decisions: 'Decisões',
    nextSteps: 'Próximos passos',
    transcript: 'Transcrição',
    flow: 'Fluxo',
    screen: 'Tela',
    screensFolder: 'telas',
    flowImage: 'Diagrama do fluxo',
    noSummary: 'O resumo não foi gerado. A transcrição completa está abaixo.',
    noSpeech: 'Nenhuma fala foi reconhecida nesta gravação.'
  }
}
