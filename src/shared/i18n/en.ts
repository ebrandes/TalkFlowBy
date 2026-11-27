// English strings. `pt.ts` must have exactly the same shape (checked by the type system).

export const en = {
  months: ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
  monthsLong: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],

  folders: { meetings: 'Meetings', notes: 'Notes' },

  rail: {
    tasks: 'To-dos',
    pinned: 'Pinned',
    emptyTasks: 'Open to-dos from your meetings and notes show up here.',
    newNote: 'New note',
    settings: 'Settings',
    search: 'Search notes',
    meetings: 'Meetings',
    notes: 'Notes',
    range: 'Range shown',
    nothingFound: (q: string) => `Nothing found for “${q}”.`,
    emptyMeetings: 'Recorded meetings show up here, filed by month.',
    emptyNotes: 'Loose notes live here.',
    createFirst: 'Create the first one'
  },

  bar: {
    eta: (min: number) => (min <= 1 ? 'about 1 min left' : `about ${min} min left`),
    queued: (n: number) => (n === 1 ? '1 more waiting' : `${n} more waiting`),
    record: 'Record',
    starting: 'Starting…',
    stop: 'Stop',
    recording: 'Recording',
    paused: 'Paused',
    pause: 'Pause',
    resume: 'Resume',
    transcribing: 'Transcribing',
    summarizing: 'Summarizing',
    summarized: 'Summarized',
    recordingOf: (when: string) => `Recording ${when}`,
    savedNoSummary: (when: string) => `Recording from ${when} saved without a summary`,
    processingError: 'Something went wrong while processing the recording.',
    missingModel: 'Transcription model missing'
  },

  note: {
    pin: 'Pin to the top of the list',
    unpin: 'Unpin',
    renameSpeaker: 'Name “Others”',
    renameSpeakerTitle: 'Who is “Others” in this meeting?',
    renameSpeakerHint: 'Replaces “Others” with this name in the whole transcript.',
    renameSpeakerPlaceholder: 'Name',
    renameSpeakerApply: 'Replace',
    trashed: (n: number) => (n === 1 ? 'Note moved to the Trash' : `${n} notes moved to the Trash`),
    undo: 'Undo',
    restored: 'Restored',
    resummarize: 'Summarize again',
    resummarizing: 'Summarizing…',
    resummarized: 'Summary updated',
    changedOutside: 'This note changed outside TalkFlowBy and was reloaded.',
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
    noTranscript: 'This note has no transcript.',
    copyMarkdown: 'Copy Markdown (Ctrl+Shift+C / ⌘⇧C)',
    copiedMarkdown: 'Note Markdown copied'
  },

  find: {
    placeholder: 'Find in note',
    count: (i: number, n: number) => `${i} of ${n}`,
    none: 'No matches',
    prev: 'Previous (Shift+Enter)',
    next: 'Next (Enter)',
    close: 'Close (Esc)'
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

  ask: {
    open: 'Ask Claude about your notes',
    openNote: 'Ask Claude about this note',
    title: 'Ask your notes',
    shortcut: (key: string) => `${key}+J`,
    scopeNote: 'This note',
    scopeAll: 'All notes',
    placeholder: 'For example: list the repositories mentioned in this conversation',
    submit: 'Ask',
    thinking: 'Reading the notes…',
    copy: 'Copy answer (Markdown)',
    copied: 'Answer copied',
    saveNote: 'Save as note',
    saved: 'Saved in Notes',
    saveFailed: 'Could not save the note.',
    askedAt: (when: string) => `Asked TalkFlowBy on ${when}. The numbers link to the notes the answer came from.`,
    sources: 'Sources',
    noSources: 'The answer did not cite any note.',
    partial: (omitted: number, trimmed: number) =>
      [omitted ? `${omitted} older ${omitted === 1 ? 'note was' : 'notes were'} left out` : '', trimmed ? `${trimmed} sent without the transcript` : '']
        .filter(Boolean)
        .join(', ') + ' to fit.',
    failed: 'Could not get an answer.',
    setupHint: 'Smart search uses the same Claude as the summaries: Claude Code signed in, or an API key in Settings.',
    close: 'Close',
    examples: {
      note: ['List the repositories mentioned in this conversation', 'What tasks were assigned to me?', 'Which decisions were made, and why?'],
      all: ['Which repositories came up in my meetings this month?', 'What are my open tasks across all meetings?', 'When did we last talk about the budget?']
    }
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
    modelReady: (name: string) => `${name}, runs on this computer`,
    modelMissing: (mb: number) => `A ${mb} MB file, downloaded once. Transcription runs on this computer.`,
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
    shortcuts: 'Keyboard shortcuts',
    shortcutRecord: 'Start or stop recording (works with the app in the background)',
    shortcutCapture: 'Capture the screen while recording (works with the app in the background)',
    shortcutNewNote: 'New note',
    shortcutSettings: 'Settings',
    shortcutFind: 'Search notes',
    shortcutFindInNote: 'Find in the open note',
    shortcutCopyMd: 'Copy the note as Markdown',
    shortcutAsk: 'Ask Claude about your notes',
    audioTest: 'Test audio',
    audioTestHint: 'Listens for 5 seconds to check that the microphone and the computer audio arrive. Play something and say a few words.',
    audioTestRun: 'Test',
    audioTestRunning: 'Listening…',
    audioMic: 'Microphone',
    audioSystem: 'Computer audio',
    audioOk: 'Sound arriving',
    audioSilent: 'No sound',
    audioBlocked: 'Not allowed',
    title: 'Settings',
    close: 'Close settings',
    general: 'General',
    appLanguage: 'App language',
    notes: 'Notes',
    folder: 'Folder',
    folderHint: 'Point it at your Obsidian vault if you like. Notes already saved stay where they are.',
    open: 'Open',
    change: 'Change…',
    meetings: 'Meetings',
    ask: 'Ask to record when I join a meeting',
    askHint: 'Teams and Google Meet in the browser',
    muted: 'No longer asks for',
    askAgain: 'Ask again',
    liveTranscription: 'Transcribe during the meeting',
    liveTranscriptionHint: 'The note is ready right after the call ends. Uses half the processor while you are in the call',
    keepAudio: 'Keep the audio after transcribing',
    keepAudioHint: 'When off, the audio is deleted once the note is ready',
    drawFlows: 'Draw the workflow',
    drawFlowsHint: 'When the meeting describes a process, a diagram goes at the end of the note',
    silenceStop: 'Stop after silence',
    silenceStopHint: 'Ends the recording when nobody has spoken for a while',
    silenceNever: 'Never',
    minutes: (n: number) => `${n} minutes`,
    checkUpdates: 'Check for updates',
    checkUpdatesHint: 'Looks for new versions on GitHub every few hours',
    openAtLogin: 'Open at login',
    openAtLoginHint: 'Stays in the tray, ready to ask',
    transcription: 'Transcription',
    quality: 'Transcription quality',
    qualityHint: 'Smaller models are much faster on computers without a graphics card',
    qualityBest: 'Best (574 MB)',
    qualityBalanced: 'Balanced, about 4x faster (190 MB)',
    qualityFast: 'Fastest, about 6x faster (60 MB)',
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
    sync: 'Sync between computers',
    syncRemote: 'Private Git repository',
    syncHint: 'Create an empty private repository (on GitHub, for example) and paste its address. The app uses the Git and the sign-in already on this computer. Recording audio never leaves the computer.',
    syncPlaceholder: 'https://github.com/you/my-notes.git',
    syncConnect: 'Connect',
    syncDisconnect: 'Turn off',
    syncNow: 'Sync now',
    syncOff: 'Off. Your notes stay only on this computer.',
    syncing: 'Syncing…',
    syncedAt: (when: string) => `Synced at ${when}. Syncs on open, after each note and every 10 minutes.`,
    syncConflicts: (n: number) => (n === 1 ? 'One note was edited on two computers: the other version was saved next to it, marked "conflict".' : `${n} notes were edited on two computers: the other versions were saved next to them, marked "conflict".`),
    syncBackup: 'Before the first sync, a full copy of the folder was saved.',
    openBackup: 'Open backup',
    syncErrors: {
      auth: 'GitHub refused the sign-in. Sign in once with Git on this computer (for example, run "git clone" of the repository in the terminal) and try again.',
      'not-found': 'Repository not found. Check the address and that this computer\'s GitHub account has access.',
      offline: 'No connection to the repository right now. It will try again in a few minutes.',
      'git-missing': 'Git is not installed. Install it from git-scm.com (on a Mac, "xcode-select --install" in the terminal) and try again.',
      'other-repo': 'This folder is already a Git repository for something else, so the app leaves it alone. Choose another folder or another repository.',
      'push-rejected': 'Another computer kept sending changes at the same time. It will try again shortly.'
    } as Record<string, string>,
    syncFailed: (msg: string) => `Sync failed: ${msg}`,
    permissions: 'Mac permissions'
  },

  recorder: {
    micOnly: 'Only your microphone is being recorded. Allow call audio in your system settings.',
    failed: (msg: string) => `Could not record: ${msg}`
  },

  widget: {
    recording: 'Recording',
    paused: 'Paused',
    pause: 'Pause',
    resume: 'Resume',
    stop: 'Stop and save',
    move: 'Drag to move',
    capture: 'Capture screen',
    captures: (n: number) => (n === 1 ? '1 screen captured' : `${n} screens captured`),
    captureFailed: 'Could not capture the screen.',
    captureNoPermission: 'Could not capture the screen. Allow Screen & System Audio Recording for TalkFlowBy in System Settings.'
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
    task: 'To-do list',
    uploadImage: 'Upload image',
    imageLink: 'or paste an image link',
    imageCaption: 'Add a caption'
  },

  autoStop: {
    lowDisk: (gb: string) => `Only ${gb} GB free on disk. A long recording may not fit.`,
    meetingEnded: (app: string) => `Recording stopped: the ${app} call ended. Your note will be ready in a few minutes.`,
    silence: (min: number) => `Recording stopped after ${min} minutes of silence. Your note will be ready in a few minutes.`,
    recovered: (n: number) => (n === 1 ? 'An interrupted recording was recovered and is being processed.' : `${n} interrupted recordings were recovered and are being processed.`)
  },

  update: {
    available: (v: string) => `Version ${v} is available`,
    ready: (v: string) => `Version ${v} is ready`,
    download: 'Download',
    restart: 'Restart to update'
  },

  tray: {
    open: 'Open TalkFlowBy',
    record: 'Record meeting',
    stop: 'Stop recording',
    quit: 'Quit',
    recordingTip: 'TalkFlowBy — recording'
  },

  errors: {
    whisper: 'Transcription failed. Try again; if it keeps failing, pick a lighter quality in Settings.',
    ffmpeg: 'Could not read the recorded audio. The audio was kept and can be retried.',
    summaryTimeout: 'The summary took too long and was cancelled. Use “Summarize again” on the note.',
    noProvider: 'No way to summarize: install Claude Code or save an Anthropic API key in Settings.',
    offline: 'No internet connection to summarize. Use “Summarize again” on the note when you are back online.',
    claude: 'Claude could not summarize this meeting. Use “Summarize again” on the note.',
    generic: (detail: string) => `Something went wrong: ${detail}`,
    summaryNotGenerated: (reason: string) => `Note saved without a summary. ${reason}`
  },

  failed: {
    title: (n: number) => (n === 1 ? 'One recording could not be processed' : `${n} recordings could not be processed`),
    lead: 'The audio is safe. Try again, or move it to the Trash.',
    retry: 'Try again',
    discard: 'Move to Trash',
    when: (date: string, min: number) => `${date} · ${min} min`
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
    flow: 'Workflow',
    flowImage: 'Workflow diagram',
    screen: 'Screen',
    screensFolder: 'screens',
    noSummary: 'The summary was not generated. The full transcript is below.',
    noSpeech: 'No speech was recognized in this recording.'
  }
}

export type Dict = typeof en
