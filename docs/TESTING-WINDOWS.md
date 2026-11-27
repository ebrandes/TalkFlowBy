# Testing on Windows

TalkFlowBy is built and unit-tested on Windows in CI, but these steps need a real Windows 10/11
PC. Each one takes a minute or two. Please report anything that fails in an
[issue](https://github.com/ebrandes/TalkFlowBy/issues), with the step number.

## 1. Install

1. Download `TalkFlowBy-x.y.z-windows-setup.exe` from the latest release.
2. On the SmartScreen warning, click **More info → Run anyway**.
3. The app opens. There is no "File Edit View" menu bar.

## 2. Tray

1. Close the window with the X. A notification says TalkFlowBy keeps running in the tray.
2. The tray icon is visible on both a dark and a light taskbar
   (*Settings → Personalization → Colors → Choose your mode*).
3. Left-click the tray icon: the window opens. Right-click: *Open*, *Record meeting*, *Quit*.

## 3. Transcription model

1. On first launch the welcome screen offers to download the model (574 MB). Click **Download**.
2. When it reaches 100%, the **Record** button becomes available.

## 4. Manual recording

1. Play a YouTube video with speech and click **Record**. Talk for 30 seconds over it.
2. Click **Stop**. The top bar shows *Transcribing* and then *Summarizing*.
3. A new note appears under *Meetings* with both **You** and **Others** in the transcript.
   If only *You* appears, call audio capture failed: note your audio output device.

## 5. Summary

- With [Claude Code](https://github.com/anthropics/claude-code) installed with the native
  installer (`claude.exe`) and signed in, the note has a summary, topics and next steps.
- Without it, add an Anthropic API key in **Settings → Summary**. Without either, the note
  still has the full transcript.

## 6. Meeting detection

1. Join a Microsoft Teams call (or Google Meet in Chrome or Edge).
2. Within about 5 seconds the recording starts by itself and a notification says
   *Recording the meeting "<name>"*. (With *Record on its own* off, a prompt asks first.)
3. Talk a little, leave the call and join another one right away. A notification says
   *New meeting*, and the first call becomes its own note.
4. Leave the second call. About 25 seconds later the recording stops by itself.
5. Dropped connection: during a Teams call, turn off Wi-Fi for a minute and turn it back on.
   The recording keeps going while the meeting window is open, and it stays one note.
6. Summary without internet: end a call with Wi-Fi off. The note is saved with the
   transcript; once Wi-Fi is back, within about 5 minutes the summary appears in it.

## 7. Recovery

1. Start a recording, then quit from the tray menu while it is still recording.
2. Open TalkFlowBy again: a notification says the recording was recovered, and the note appears.

## 8. Notes

1. Create a note, type `/` and add a heading and a to-do. Rename the file from the top bar.
2. Select two notes with the selection button and move them to the Recycle Bin.
3. Open the notes folder from **Settings → Notes → Open**: files are plain `.md`.
