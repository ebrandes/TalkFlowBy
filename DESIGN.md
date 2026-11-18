---
name: TalkFlowBy
description: Minimal meeting recorder and note-taker where every meeting is filed like a stamped protocol.
colors:
  ground: "#f6f8f5"
  rail: "#e3e8e1"
  raised: "#fbfcfa"
  hover: "#d9e0d7"
  rule: "#cdd5cc"
  rule-strong: "#aab5ab"
  ink: "#1c2220"
  ink-2: "#4a5550"
  ink-3: "#5e6a64"
  violet: "#5b3fa8"
  violet-ink: "#ffffff"
  violet-tint: "#e9e4f6"
  rec: "#b42d27"
  rec-tint: "#f6e1df"
  rec-ink: "#ffffff"
  ok: "#2f6b45"
  warn: "#8a5a00"
  warn-tint: "#f5ead3"
  ground-dark: "#15181a"
  rail-dark: "#1b1f21"
  raised-dark: "#202528"
  hover-dark: "#262c2f"
  rule-dark: "#2b3134"
  rule-strong-dark: "#3d4549"
  ink-dark: "#e6eae7"
  ink-2-dark: "#b1bab5"
  ink-3-dark: "#96a19b"
  violet-dark: "#b4a2f2"
  violet-ink-dark: "#17131f"
  violet-tint-dark: "#2a2440"
  rec-dark: "#f0716a"
  rec-tint-dark: "#3a2120"
  rec-ink-dark: "#2a0e0c"
  ok-dark: "#7cc797"
  warn-dark: "#e2b45a"
  warn-tint-dark: "#352b17"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 650
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  body-reading:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "tnum"
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.35
  caption:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.45
  stamp:
    fontFamily: "ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, Consolas, monospace"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.09em"
  guide:
    fontFamily: "ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.06em"
rounded:
  seal: "3px"
  sm: "5px"
  segment: "6px"
  md: "8px"
  window: "12px"
  pill: "20px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "34px"
  button-primary-hover:
    backgroundColor: "{colors.ink-2}"
  button-secondary:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "34px"
  button-secondary-hover:
    backgroundColor: "{colors.hover}"
  button-danger:
    backgroundColor: "{colors.rec}"
    textColor: "{colors.rec-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "34px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "34px"
  button-ghost-hover:
    backgroundColor: "{colors.hover}"
  icon-button:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.md}"
    size: "32px"
  icon-button-hover:
    backgroundColor: "{colors.hover}"
    textColor: "{colors.ink}"
  field:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "34px"
  stamp:
    backgroundColor: "transparent"
    textColor: "{colors.violet}"
    typography: "{typography.stamp}"
    rounded: "{rounded.sm}"
    padding: "6px 6px 6px 12px"
  stamp-state:
    backgroundColor: "{colors.violet}"
    textColor: "{colors.violet-ink}"
    rounded: "{rounded.seal}"
    padding: "4px 7px"
  stamp-live:
    textColor: "{colors.rec}"
  stamp-live-state:
    backgroundColor: "{colors.rec}"
    textColor: "{colors.rec-ink}"
  date-block:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sm}"
    size: "42px"
  date-block-selected:
    textColor: "{colors.violet}"
  list-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  list-row-selected:
    backgroundColor: "{colors.raised}"
  segmented:
    backgroundColor: "{colors.hover}"
    rounded: "{rounded.md}"
    padding: "2px"
  segmented-selected:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.segment}"
    height: "28px"
---

# Design System: TalkFlowBy

## Overview

**Creative North Star: "Carimbo e Protocolo"**

TalkFlowBy is a records office for meetings. The ground is cool grey-green form paper, the text is near-black ink, and each meeting carries a dated rubber stamp in stamp-pad violet that says when it happened and where it stands (Gravando, Transcrevendo, Resumindo, Resumido). The stamp is the one decorative act in the system; everything around it is plain office stationery: hairline rules, a ruled list of filed meetings with small date stamps, and a single reading column.

The density is that of a calm desktop tool, not a dashboard. One window, a 300px rail of filed meetings and notes, a 56px top bar holding the record action, and a 720px reading column. Colour is almost absent: violet appears only where something has a state (the stamp, a selected date block, focus, a checked task, an active toggle, a link), and red appears only when the microphone is live or something failed. Light and dark follow the operating system; dark is graphite-green with a lifted lavender violet.

Motion is short and functional: 160ms ease-out state swaps, and the stamp's state word re-inks in place with a small scale-down when the stage changes. There is no entrance choreography.

**Key Characteristics:**
- Grey-green form paper and near-black ink; violet and red are state, not decoration.
- The dated stamp (double-ruled, monospace, uppercase, inverted state seal) is the signature.
- System UI sans for all reading and chrome; monospace only for stamped and measured things.
- Flat: hairline rules and tonal layers, shadows only on floating menus.
- Lucide outline icons at stroke 1.75, used sparingly.

## Colors

A near-monochrome stationery palette with two reserved inks.

### Primary
- **Stamp-Pad Violet** (light `violet`, dark `violet-dark`): the stamp's border, text and inverted state seal; the selected row's date block; the focus ring and field focus border; checked toggles and tasks; the active editor toolbar item; download progress; inline links. Its pale **Violet Wash** (`violet-tint`) carries text selection, the field focus halo and progress fill.

### Secondary
- **Live Red** (`rec`, dark `rec-dark`): the live recording stamp and its timer, the Parar button, and error states (pipeline error banner, error hints, editor error colour). **Red Wash** (`rec-tint`) backs the error banner.

### Tertiary
- **Ledger Green** (`ok`): the "Pronto" / "Liberado" confirmation marks in setup.
- **Amber Notice** (`warn` on `warn-tint`): non-fatal warnings in the top bar (saved without summary, recorder warnings).

### Neutral
- **Form Paper** (`ground`): content area and editor background.
- **Rail Paper** (`rail`): the left rail.
- **Raised Sheet** (`raised`): buttons, fields, selected rows, the setup card, the meeting prompt.
- **Thumb Grey** (`hover`): hover fills and the segmented control track.
- **Hairline** (`rule`) and **Strong Hairline** (`rule-strong`): dividers, borders, unselected date blocks, the off switch.
- **Ink** (`ink`), **Ink 2** (`ink-2`), **Ink 3** (`ink-3`): primary text and the primary button; secondary text and icons; metadata, placeholders, guide words.

### Named Rules
**The Stamp-Pad Rule.** Violet marks state and the stamp, nothing else. It is never a fill for a primary button, never a heading colour, never a background panel. The primary action is ink.

**The Live Ink Rule.** Red means the microphone is on or something broke. Nothing else may be red, so a red stamp in the top bar is always trustworthy.

**The Two Themes Rule.** Every colour exists as a light and a dark token, switched by `prefers-color-scheme`. Never hard-code a colour that only works in one theme.

## Typography

**Body Font:** System UI sans (`-apple-system`, SF Pro Text, Segoe UI Variable Text, `system-ui`)
**Label/Mono Font:** System monospace (`ui-monospace`, SF Mono, Cascadia Mono, Menlo, Consolas)

**Character:** The platform's own sans for everything a person reads, so the app feels native on macOS and Windows; monospace is the rubber-stamp and ledger voice, uppercase and tracked, used only where something is stamped or measured. Body numerals are tabular everywhere.

### Hierarchy
- **Display** (650, 1.875rem, 1.2, -0.02em): note H1, Configurações, welcome title.
- **Headline** (650, 1.25rem, 1.3, -0.01em): note H2 sections (Tópicos, Decisões, Próximos passos, Transcrição), each opened by a hairline rule.
- **Title** (650, 1.0625rem): note H3, the meeting prompt's question; the lead summary uses this size at 400 in `ink-2`.
- **Body reading** (400, 16px, 1.6): editor paragraphs and lists, capped at the 600px line.
- **Body** (400, 0.9375rem, 1.55): app chrome default.
- **Label** (600, 0.8125rem): buttons, row titles, breadcrumb name, settings labels (500).
- **Caption** (400, 0.75rem): row time, hints, month headings (600), warnings.
- **Stamp** (mono 700, 11px, 0.09em, uppercase): stamps; date blocks use the same voice at 9.5px month / 15px day.
- **Guide** (mono 600, 0.75rem, 0.06em, uppercase): the guide words above the list.

### Named Rules
**The Measured Mono Rule.** Monospace appears only inside stamps (including the live timer), date blocks, guide words, and literal measurements or machine text (progress percentage, file paths, inline code). Never for headings, labels or body.

**The No Kicker Rule.** Uppercase tracked text belongs to the stamp family only. Sections are named by sentence-case headings, never by small uppercase labels above them.

## Layout

A fixed desktop shell: a 300px rail (`--rail-width`) and a flexible main area, separated by a hairline. Both start with a 56px bar (`--bar-height`) that doubles as the window drag region; on macOS the rail head clears the traffic lights with 84px left padding. The rail stacks app name with icon actions, search, the Reuniões/Notas segmented control, the guide-word band between two hairlines, then month groups of rows. Only the selected meeting row expands to show a three-line summary preview.

The reading column is 720px (`--measure`) centered in the main area with 32px padding; paragraphs and list items inside it are capped at a 600px line (`--line`, about 62 characters). Settings and setup reuse the same column. Spacing follows a 4px base (4, 8, 12, 16, 20, 24, 32, 40). Settings are ruled rows: label left, control right, a hairline between rows.

**The One Column Rule.** Reading content lives in the 720px column with text at the 600px line. Don't widen text to fill the window.

## Elevation & Depth

Flat by default. Depth comes from tonal layering (rail paper, form paper, raised sheet) and 1px hairlines. The selected row is a raised sheet ringed by a 1px rule, not a shadow.

### Shadow Vocabulary
- **Floating menu** (`--shadow`: light `0 8px 24px rgb(28 34 32 / 0.14), 0 2px 6px rgb(28 34 32 / 0.08)`, dark `0 8px 24px rgb(0 0 0 / 0.45), 0 2px 6px rgb(0 0 0 / 0.3)`): editor slash menu, formatting toolbar, link preview and edit popovers only.
- **Control lift** (`0 1px 2px`): the selected segment and the switch knob, a hairline physical cue.

**The Paper Stack Rule.** Surfaces sit flat on the desk; only things that float over the page (menus, popovers) cast a shadow.

## Shapes

Gently rounded office stationery. Controls, rows, fields and cards use 8px; stamps and date blocks use a tighter 5px so they read as rubber, with the inverted state seal at 3px; segments 6px; the floating meeting prompt window 12px (square on Windows, where the window is opaque); the switch is a pill. Borders are 1px hairlines; stamps and date blocks use a 1.5px line, and the stamp adds a second 1px outline offset 2px, the double rule of a real date stamp.

## Components

### Buttons
One vocabulary across the app: 34px tall, 8px radius, 16px horizontal padding, 13px semibold text, 160ms background transition, a 0.5px press nudge.
- **Primary (ink):** ink fill, paper text; hover shifts to ink-2. Used for Gravar and the prompt's Gravar. Disabled primary turns into an outlined, ink-3 button instead of fading.
- **Danger (live red):** only for Parar while recording.
- **Secondary:** raised sheet with hairline border; hover to thumb grey. Settings row actions (Abrir pasta, Baixar, Liberar) are text-only.
- **Ghost:** transparent; hover fill. Used for low-stakes actions such as "Nunca para este app".
- **Icon button:** 32px square, ink-2 icon, hover fill and ink. Always carries an aria-label.
- Record and stop glyphs are filled Lucide `Circle` / `Square` at stroke 2 inside the button; other buttons carry an icon only when it names the action (welcome "Nova nota").

### Inputs / Fields
- **Style:** 34px, raised sheet, 1px hairline, 8px radius, 12px padding, ink-3 placeholder.
- **Focus:** border turns violet with a 3px violet-wash halo; the search box applies the same treatment through `:focus-within`.
- **Inline rename:** the breadcrumb note name is a borderless field that shows a hairline on hover and a violet border on focus.

### Navigation
- **Segmented control:** thumb-grey track with 2px padding; the selected segment is a raised sheet with semibold ink text and a control-lift shadow.
- **List rows:** 8px radius, hover fill, selected = raised sheet ringed by a hairline. Meeting rows lead with a date block; free notes lead with a Lucide `FileText`. Titles clamp to two lines (one for notes).
- **Guide words:** first and last date in view, mono uppercase, between two hairlines, like a dictionary's running head.

### Toggle
A 36 by 20 pill: strong-hairline track when off, violet when on, white knob with a control-lift shadow, 160ms slide.

### The Stamp (signature)
Inline, double-ruled, violet, monospace uppercase. Holds dot-separated parts (date, time, duration, origin) and an inverted seal with the state word. When recording it becomes the Live stamp: everything turns red and the parts become the running `mm:ss` timer, whose digits change in place. When the stage changes, the seal re-inks with a 160ms scale-from-1.12 fade (`stamp-in`). The same stamp reports pipeline progress in the top bar.

### Date Block
42px square, 1.5px strong-hairline border, 5px radius, mono month (9.5px uppercase) over a two-digit day (15px). Turns violet on the selected row.

### Meeting Prompt
A small floating card (raised sheet, hairline, 12px radius) with a title question, one line of context, a ghost "never" link-button on the left, and Agora não + primary Gravar on the right. Close is a 26px icon button.

## Do's and Don'ts

### Do:
- **Do** keep violet for the stamp and for state (selected, focus, checked, active, progress, links), per The Stamp-Pad Rule.
- **Do** reserve red for the live recording stamp, the Parar button and errors.
- **Do** put every new colour in both themes in `tokens.css` and switch it by `prefers-color-scheme`.
- **Do** set reading text inside the 720px column at the 600px line.
- **Do** use Lucide outline icons at strokeWidth 1.75 (2 only for filled record/stop glyphs and check marks), sized 15 to 18px.
- **Do** keep settings labels, hints and settings row buttons text-only.
- **Do** use the mono uppercase stamp voice for anything stamped or measured, and nothing else.

### Don't:
- **Don't** use violet as a button fill, panel background or heading colour; the primary action is ink.
- **Don't** use red for emphasis, counts or destructive-but-idle actions such as delete.
- **Don't** add shadows to cards, rows or the reading column; only floating menus cast one.
- **Don't** add uppercase eyebrow labels above headings; sections are named by sentence-case headings.
- **Don't** use any icon set other than Lucide, or decorative icons beside labels.
- **Don't** add entrance animations; state changes swap in place in 160ms.

## App icon

The double-ruled stamp from the interface, drawn in ground white on a stamp-pad violet tile
(#6B4FC2 to #47308E), holding the Lucide `audio-lines` waveform, with the live-red dot
(#F0716A) on the stamp's corner. Sources and size variants live in `build/icon-src/`:
the full mark from 48 px up, a single-rule heavier version for 24 and 32 px, and a
three-bar version for 16 px. `build/icon.icns`, `build/icon.ico` and `build/icon.png`
are what the installer uses.
