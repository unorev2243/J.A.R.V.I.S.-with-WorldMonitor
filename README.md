# Jarvis — Personal AI Desktop Assistant

A Jarvis-style personal AI assistant for **Windows 11** with full PC access, continuous voice mode, persistent memory, and a global hotkey. Built as an **Electron** desktop app with a **local Ollama** brain and **local SQLite** memory — your data never leaves your machine.

## What it does

- **Voice mode** — push-to-talk + continuous mode with the concentric-ring HUD
- **Global hotkey** — `Ctrl + Space` summons Jarvis from anywhere on Windows
- **System tray** — always running in the background
- **Local AI brain** — talks to Ollama at `http://localhost:11434` (free, offline, private)
- **Persistent memory** — SQLite stored in `%APPDATA%/Jarvis/jarvis.db`
- **Action log with revert** — every shell command, file change, and app launch is logged with undo data
- **Brainstorm chat** — separate threaded chat for ideation
- **Code on demand** — `/code` screen cooks projects via Gemini CLI and hands them off to Google Antigravity with one click
- **Proactive suggestions** — background daemon that offers context-aware suggestions
- **WorldMonitor map** — embedded global situational-awareness view
- **Integrations** — pluggable panel for calendar, email, Antigravity, etc.

## Quick start (Windows 11)

### 1. Install Ollama (one time)

Go to [ollama.com](https://ollama.com) and download the Windows installer. Then in PowerShell:

```powershell
ollama pull llama3.2          # fast, ~2GB
# or for a smarter model:
ollama pull qwen2.5:7b        # ~4.7GB, needs ~6GB RAM
```

Ollama runs as a background service on port `11434`. Jarvis auto-detects whichever model you have.

### 2. (Optional) Install Gemini CLI + Antigravity for the Code screen

Jarvis's `/code` screen "cooks" projects by spawning the official **Gemini CLI** in a project folder. Free tier: **1000 requests/day** with Gemini 3 Pro/Flash on a personal Gmail account.

```powershell
# Gemini CLI
npm i -g @google/gemini-cli
gemini                 # one-time OAuth, sign in with Google
```

For the **Open in Antigravity** button to work, install **Google Antigravity** (the agent-first IDE built on a VS Code fork) from [antigravity.google](https://antigravity.google). Jarvis auto-detects it at:

- `%LOCALAPPDATA%\Programs\Antigravity\bin\antigravity.cmd`
- `%LOCALAPPDATA%\Programs\Antigravity\Antigravity.exe`

If neither tool is installed, the `/code` screen still loads — it just shows the missing-tooling badge and the "Cook" button surfaces a setup hint.

### 3. Install Jarvis

```powershell
git clone <this-repo>
cd jarvis
pnpm install
```

### 4. Run in dev mode

```powershell
pnpm electron:dev
```

This:
1. Starts the Next.js renderer at `localhost:3000`
2. Compiles the Electron main process
3. Launches the Electron window
4. Registers `Ctrl + Space` as the global hotkey
5. Adds an icon to your system tray

### 5. Build a packaged installer

```powershell
pnpm electron:build
```

Outputs an NSIS installer to `release/`.

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│ ELECTRON RENDERER (Next.js, this repo /app)                │
│  - Dashboard with concentric-ring voice HUD                │
│  - WorldMonitor map view, Chat, Action Log, Memory, etc.   │
│  - Talks to main process via window.jarvis (preload IPC)   │
└──────────────────────┬─────────────────────────────────────┘
                       │ IPC (contextBridge)
┌──────────────────────▼─────────────────────────────────────┐
│ ELECTRON MAIN (/electron/main.ts)                          │
│  - Global hotkey (Ctrl+Space)                              │
│  - System tray                                             │
│  - Window management                                       │
│  - Permission gating for shell/file actions                │
└─┬──────────┬──────────┬──────────┬──────────┬──────────────┘
  │          │          │          │          │
  ▼          ▼          ▼          ▼          ▼
Ollama   SQLite    Shell      Screen    Proactive
client   memory    runner     capture   daemon
                   + revert
```

### File layout

```
/app                  Next.js renderer (UI screens)
/components           React UI components
/lib                  Browser-safe utilities + jarvis-bridge
/electron
  main.ts             Electron main process entry
  preload.ts          contextBridge → window.jarvis
  /lib
    ollama.ts         Local LLM client
    memory.ts         SQLite memory + semantic recall
    action-log.ts     Action audit log with revert data
    shell-runner.ts   Safe shell exec with allowlist + revert
    launcher.ts       Open apps / files / URLs
    screen.ts         Screen capture via desktopCapturer
    proactive.ts      Background suggestion daemon
/scripts
  build-electron.ts   esbuild compile of main+preload
```

## Security model

- **Allowlist for shell commands.** By default Jarvis only runs commands from a curated allowlist (e.g. `dir`, `git status`, `code .`). You expand the list in **Settings → Permissions**.
- **Confirmation prompts** for file deletes, app installs, and anything destructive.
- **Action log is append-only.** Every action stores a `revertData` blob — file deletes save the original, registry tweaks save the prior key, etc.
- **No telemetry.** All data is local SQLite. Nothing is sent to any server unless you enable a cloud integration in Settings.

## Adding the assistant API key (optional)

If you want a cloud fallback when Ollama isn't running, add `GROQ_API_KEY` or `OPENAI_API_KEY` in **Settings → Providers**. Stored encrypted via Electron's `safeStorage`.

## Hotkeys

| Action               | Hotkey         |
| -------------------- | -------------- |
| Summon Jarvis        | `Ctrl + Space` |
| Toggle voice mode    | `Ctrl + Shift + V` |
| Hide window          | `Esc`          |

Edit in **Settings → Hotkeys**.

## Development notes

- The renderer code (`/app`, `/components`) is pure Next.js and previews fine in any browser. When the `window.jarvis` bridge isn't present, it falls back to mock data so you can iterate on UI without launching Electron.
- `better-sqlite3` is in `optionalDependencies` so cloud sandboxes that don't compile native modules still install successfully. On your Windows machine it builds against your local Electron headers.
- Run `pnpm electron:compile` standalone if you only want to rebuild the main process.
