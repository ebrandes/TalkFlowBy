// English strings. `pt.ts` must have exactly the same shape (checked by the type system).

export const en = {
  months: ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
  monthsLong: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],

  folders: { meetings: 'Meetings', notes: 'Notes' },

  rail: {
    newNote: 'New note',
    settings: 'Settings',
    search: 'Search titles',
    meetings: 'Meetings',
    notes: 'Notes',
    range: 'Range shown',
    nothingFound: (q: string) => `Nothing titled “${q}”.`,
    emptyMeetings: 'Recorded meetings show up here, filed by month.',
    emptyNotes: 'Loose notes live here.',
    createFirst: 'Create the first one'
  },

  bar: {
    record: 'Record',
    starting: 'Starting…',
    stop: 'Stop',
    recording: 'Recording',
    transcribing: 'Transcribing',
    summarizing: 'Summarizing',
    summarized: 'Summarized',
    recordingOf: (when: string) => `Recording ${when}`,
    savedNoSummary: (when: string) => `Recording from ${when} saved without a summary`,
    processingError: 'Something went wrong while processing the recording.',
    missingModel: 'Transcription model missing'
  },

  note: {
    summarized: 'Summarized',
    noSummary: 'No summary',
    openError: 'This note could not be opened. It may have been moved or deleted.',
    reveal: 'Show file in folder',
    trash: 'Move to Trash',
    fileName: 'File name',
    rename: 'Click to rename the file',
    share: 'Send or copy',
    copyNote: 'Copy note (Markdown)',
    copyTranscript: 'Copy transcript',
    openClaude: 'Open in Claude',
    copied: 'Copied to the clipboard',
    copiedForClaude: 'Note copied. If it is not already in Claude, paste it with Ctrl+V or ⌘V.',
    noTranscript: 'This note has no transcript.'
  },

  confirm: {
    trashOne: 'Move this note to the Trash?',
    trashMany: (n: number) => `Move ${n} notes to the Trash?`,
    trashHint: 'You can restore them from the system Trash.',
    cancel: 'Cancel',
    trash: 'Move to Trash'
  },

  select: {
    start: 'Select notes',
    done: 'Done',
    count: (n: number) => (n === 1 ? '1 selected' : `${n} selected`),
    all: 'Select all',
    none: 'Select none',
    trash: 'Move to Trash'
  },

  welcome: {
    recordingTitle: 'Recording the meeting',
    recordingLead: 'Carry on with your call. When you stop, the transcript and summary show up in the list within a few minutes.',
    idleTitle: 'No meeting open',
    idleLead: 'Click Record at the top, or answer Record on the prompt that appears when you join Teams or Google Meet.',
    how1: 'Records your voice and the call audio, with no bot joining the meeting.',
    how2: 'Transcribes on this computer, keeping you apart from the others.',
    how3: 'Claude Haiku organizes it into a summary, decisions and next steps.',
    notesTitle: 'No note open',
    notesLead: 'Pick a note from the list or start a new one. Type / inside a note to add headings, lists and to-dos.',
    newNote: 'New note'
  },

  setup: {
    title: 'Before your first recording',
    model: 'Transcription model',
    modelReady: 'Whisper large-v3-turbo, runs on this computer',
    modelMissing: 'A 574 MB file, downloaded once. Transcription runs on this computer.',
    ready: 'Ready',
    download: 'Download',
    microphone: 'Microphone',
    microphoneHint: 'To record your voice',
    callAudio: 'Call audio',
    callAudioHint: 'macOS calls it “Screen & System Audio Recording”. No image is recorded.',
    allowed: 'Allowed',
    allow: 'Allow',
    openSettings: 'Open settings'
  },

  settings: {
    title: 'Settings',
    close: 'Close settings',
    general: 'General',
    appLanguage: 'App language',
    notes: 'Notes',
    folder: 'Folder',
    open: 'Open',
    meetings: 'Meetings',
    ask: 'Ask to record when I join a meeting',
    askHint: 'Teams and Google Meet in the browser',
    muted: 'No longer asks for',
    askAgain: 'Ask again',
    keepAudio: 'Keep the audio after transcribing',
    keepAudioHint: 'When off, the audio is deleted once the note is ready',
    silenceStop: 'Stop after silence',
    silenceStopHint: 'Ends the recording when nobody has spoken for a while',
    silenceNever: 'Never',
    minutes: (n: number) => `${n} minutes`,
    openAtLogin: 'Open at login',
    openAtLoginHint: 'Stays in the tray, ready to ask',
    transcription: 'Transcription',
    meetingLanguage: 'Meeting language',
    langPt: 'Portuguese',
    langEn: 'English',
    langEs: 'Spanish',
    langAuto: 'Detect automatically',
    summary: 'Summary',
    whoSummarizes: 'Who writes the summary',
    modelHint: 'Claude Haiku model',
    providerAuto: 'Claude subscription, with the API key as backup',
    providerCli: 'Claude subscription only (Claude Code)',
    providerApi: 'API key only',
    apiKey: 'Anthropic API key',
    keySaved: 'Key saved in the system keychain.',
    keyOptional: 'Optional if Claude Code is installed.',
    save: 'Save',
    remove: 'Remove',
    permissions: 'Mac permissions'
  },

  recorder: {
    micOnly: 'Only your microphone is being recorded. Allow call audio in your system settings.',
    failed: (msg: string) => `Could not record: ${msg}`
  },

  prompt: {
    title: 'Record this meeting?',
    desc: (app: string) => `Meeting in ${app}. Remember to tell everyone.`,
    close: 'Close',
    record: 'Record'
  },

  editor: {
    placeholder: 'Write here, or type / to add a block',
    bold: 'Bold',
    italic: 'Italic',
    strike: 'Strikethrough',
    code: 'Code',
    link: 'Link',
    linkPlaceholder: 'Paste or type a link',
    text: 'Text',
    paragraph: 'Paragraph',
    h1: 'Large heading',
    h2: 'Medium heading',
    h3: 'Small heading',
    quote: 'Quote',
    divider: 'Divider',
    lists: 'Lists',
    bullet: 'Bulleted list',
    ordered: 'Numbered list',
    task: 'To-do list'
  },

  autoStop: {
    meetingEnded: (app: string) => `Recording stopped: the ${app} call ended. Your note will be ready in a few minutes.`,
    silence: (min: number) => `Recording stopped after ${min} minutes of silence. Your note will be ready in a few minutes.`,
    recovered: (n: number) => (n === 1 ? 'An interrupted recording was recovered and is being processed.' : `${n} interrupted recordings were recovered and are being processed.`)
  },

  tray: {
    open: 'Open TalkFlowBy',
    record: 'Record meeting',
    stop: 'Stop recording',
    quit: 'Quit',
    recordingTip: 'TalkFlowBy — recording'
  },

  main: {
    missingWhisper: 'Transcription unavailable: Whisper or the model is missing. The audio was kept.',
    newNote: 'New note',
    untitled: 'Untitled',
    stillInTray: 'TalkFlowBy keeps running in the system tray, ready to ask when a meeting starts. Right-click the tray icon to quit.'
  },

  doc: {
    you: 'You',
    others: 'Others',
    keys: { date: 'date', duration: 'duration', source: 'source' },
    untitled: 'Meeting without a subject',
    fileSubject: 'Meeting',
    topics: 'Topics',
    decisions: 'Decisions',
    nextSteps: 'Next steps',
    transcript: 'Transcript',
    noSummary: 'The summary was not generated. The full transcript is below.',
    noSpeech: 'No speech was recognized in this recording.'
  }
}

export type Dict = typeof en
