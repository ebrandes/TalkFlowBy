# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(Desktop app built with Electron; the interface is web technology rendered inside a native window on macOS and Windows. Native conventions that matter: tray/menu-bar icon, window controls, system permission prompts.)

## Stack

Electron (≥ 39) + TypeScript + React + Vite (`electron-vite`), packaged with `electron-builder` (dmg on macOS, NSIS installer on Windows). Editor: Milkdown Crepe. Icons: Lucide (`lucide-react`) only. Chosen with the owner during planning.

## Users

The owner and a few people close to them (partners, colleagues, family), each running the app on their own computer with their own notes. Main situation: corporate work meetings on Microsoft Teams and Google Meet, often back to back, where the person wants to stay in the conversation instead of taking notes, and later needs to recall what was decided and what they owe.

## Product Purpose

A minimal note-taking app with a built-in meeting recorder. It captures both sides of a call (microphone and system audio, no bot joins the meeting), transcribes locally with Whisper, and asks Claude Haiku for a short structured summary. Each meeting lands as a readable markdown file organized by date and subject. Success: the person clicks Record (or accepts the meeting prompt), forgets about it, and after the call finds a clean note with summary, decisions and next steps, without paying a monthly notes subscription.

## Positioning

Replaces paid meeting-notes tiers (Notion Business) for a small circle of users: no bot in the call, transcription runs on the user's machine, the summary uses the user's own Claude subscription, and every note is a plain `.md` file the user owns and can open anywhere.

## Operating Context

- Runs minimized in the tray/menu bar all day; the window is opened to read or edit notes.
- Detects when Teams or a browser (Google Meet) starts using the microphone and asks, in a small prompt, whether to record.
- Notes live in a folder the app manages (default `~/Documents/TalkFlowBy/`): `Reuniões/<ano>/<mês>/` and `Notas/`. Files are renamable from the app.
- Summaries go through `claude -p --model haiku` when Claude Code is installed, otherwise through an Anthropic API key set in Settings. Corporate meetings are summarized the same way (owner's decision).
- Interface language: Portuguese (Brazil).

## Capabilities and Constraints

- Record mic + system audio as two tracks ("Você" / "Outros"); transcribe with whisper.cpp (`ggml-large-v3-turbo-q5_0`); summarize with Haiku into topics, decisions and next steps; write a formatted `.md`.
- Basic block editor for free notes and for editing meeting notes.
- macOS 14.2+ (system audio capture) and Windows 10/11.
- Not signed with Apple/Microsoft certificates yet; installers show OS security warnings.
- No sync, no accounts, no mobile in this version.
- Code files stay under 400 lines each.

## Brand Commitments

- Simple, easy, minimal: one window, one main action, sensible defaults. (Owner's words: "simples, coisa fácil de usar, minimalista".)
- Icons from Lucide only.
- Light and dark themes.

## Evidence on Hand

No real meeting notes, screenshots, logos or brand assets exist yet. Any sample meeting content used in development is synthetic and must be labeled as such.

## Product Principles

1. Recording must never get in the way of the meeting: one click or one answer, then silence.
2. The note is the product: readable as plain text, structured enough to scan in seconds.
3. The user owns the files: plain markdown in a normal folder, no lock-in.
4. Defaults that work: a first-time user records a meeting without opening Settings.
5. Honest status: always clear whether it is recording, processing, or idle.
