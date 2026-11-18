---
version: 1
slug: "src-renderer-src-app-tsx"
primary_target: "src/renderer/src/App.tsx"
related_targets: ["src/renderer/src/prompt/PromptApp.tsx"]
---

# Surface: TalkFlowBy main window + meeting prompt

Mode: Operate. Audience: owner and a few people, corporate Teams/Meet meetings, daytime office light, laptop. Task: record with one action, find and read meeting notes, write free notes. Constraints: minimal, Lucide icons only, light and dark, PT-BR, Electron on macOS and Windows.

## Direction contract

THESIS: Every meeting is filed like a stamped protocol: a dated violet stamp states when it happened and where it stands (gravando, transcrevendo, resumido). Refuses the category default of a grey sidebar with a blue accent and anonymous rows.

OWN-WORLD: Cool grey-green form-paper ground (#F6F8F5 content, #E3E8E1 rail, #CDD5CC rules), near-black ink #1C2220, stamp-pad violet #5B3FA8 reserved for state and the stamp, red #B42D27 only for live recording. Dark: graphite-green #15181A, rail #1B1F21, violet #B4A2F2. System UI sans for everything; ui-monospace uppercase tracked only inside stamps and timers (measurement). Hairline rules, 8px radii, no shadows except floating menus.

STORY: The user sees their meetings filed by month, opens one, reads summary, decisions and next steps in seconds, and trusts that recording is either on (red timer) or off.

FIRST VIEWPORT: Left rail 300px: app name + new-note button, search, segmented Reuniões/Notas, guide-word span (first and last date in view), month groups with rows (date stamp block + subject + time). Right: top bar with breadcrumb, status line, Gravar/Parar primary button with tabular timer; below, a 720px reading column: dated stamp, H1 subject, lead summary, Tópicos, Decisões, Próximos passos, Transcrição.

FORM: Carimbo e Protocolo (repartição: carimbo datador, almofada violeta, formulário). Position 7 of my ordered list. seed:74cd74b2709af46b. Raises kept: guide words in list header (lexicon); violet only for state (airport); fixed recording bar, numerals change in place (split-flap); summary preview only on selected row (streaming).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Signature interaction: the stamp updates its state word in place as a recording moves through gravando → transcrevendo → resumindo → resumido. Motion grammar: 160ms ease-out state swaps, no entrance choreography.
