// Textos em português do Brasil. Mesmo formato do `en.ts`.
import type { Dict } from './en'

export const pt: Dict = {
  months: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
  monthsLong: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],

  folders: { meetings: 'Reuniões', notes: 'Notas' },

  rail: {
    newNote: 'Nova nota',
    settings: 'Configurações',
    search: 'Buscar pelo título',
    meetings: 'Reuniões',
    notes: 'Notas',
    range: 'Intervalo listado',
    nothingFound: (q) => `Nada com “${q}” no título.`,
    emptyMeetings: 'As reuniões gravadas aparecem aqui, organizadas por mês.',
    emptyNotes: 'Notas soltas ficam aqui.',
    createFirst: 'Criar a primeira'
  },

  bar: {
    record: 'Gravar',
    starting: 'Iniciando…',
    stop: 'Parar',
    recording: 'Gravando',
    transcribing: 'Transcrevendo',
    summarizing: 'Resumindo',
    summarized: 'Resumido',
    recordingOf: (when) => `Gravação ${when}`,
    savedNoSummary: (when) => `Gravação de ${when} salva sem resumo`,
    processingError: 'Algo deu errado ao processar a gravação.',
    missingModel: 'Falta o modelo de transcrição'
  },

  note: {
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
    noTranscript: 'Esta nota não tem transcrição.'
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
    modelReady: 'Whisper large-v3-turbo, roda neste computador',
    modelMissing: 'Arquivo de 574 MB, baixado uma vez. A transcrição roda neste computador.',
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
    title: 'Configurações',
    close: 'Fechar configurações',
    general: 'Geral',
    appLanguage: 'Idioma do app',
    notes: 'Notas',
    folder: 'Pasta',
    open: 'Abrir',
    meetings: 'Reuniões',
    ask: 'Perguntar se quero gravar quando entro numa reunião',
    askHint: 'Teams e Google Meet no navegador',
    muted: 'Não pergunta mais para',
    askAgain: 'Voltar a perguntar',
    keepAudio: 'Guardar o áudio depois de transcrever',
    keepAudioHint: 'Desligado, o áudio é apagado quando a nota fica pronta',
    silenceStop: 'Parar depois de silêncio',
    silenceStopHint: 'Encerra a gravação quando ninguém fala por um tempo',
    silenceNever: 'Nunca',
    minutes: (n) => `${n} minutos`,
    openAtLogin: 'Abrir junto com o computador',
    openAtLoginHint: 'Fica na bandeja, pronto para perguntar',
    transcription: 'Transcrição',
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
    task: 'Tarefas'
  },

  autoStop: {
    meetingEnded: (app) => `Gravação encerrada: a chamada no ${app} terminou. A nota fica pronta em alguns minutos.`,
    silence: (min) => `Gravação encerrada depois de ${min} minutos de silêncio. A nota fica pronta em alguns minutos.`,
    recovered: (n) => (n === 1 ? 'Uma gravação interrompida foi recuperada e está sendo processada.' : `${n} gravações interrompidas foram recuperadas e estão sendo processadas.`)
  },

  tray: {
    open: 'Abrir TalkFlowBy',
    record: 'Gravar reunião',
    stop: 'Parar gravação',
    quit: 'Sair',
    recordingTip: 'TalkFlowBy — gravando'
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
    noSummary: 'O resumo não foi gerado. A transcrição completa está abaixo.',
    noSpeech: 'Nenhuma fala foi reconhecida nesta gravação.'
  }
}
