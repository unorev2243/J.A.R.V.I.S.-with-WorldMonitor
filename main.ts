/**
 * Jarvis — Electron main process.
 *
 * - Loads the Next.js renderer (dev: http://localhost:3000, prod: file://out/index.html)
 * - Creates a system tray icon
 * - Registers a global hotkey (default Ctrl+Space) to summon/hide the window
 * - Exposes the JarvisAPI to the renderer via the preload script
 *
 * IMPORTANT: This file is compiled separately from Next.js. See electron/tsconfig.json.
 */

import { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, shell, nativeImage } from "electron"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { ollamaChat, ollamaStatus } from "./lib/ollama"
import { memory } from "./lib/memory"
import { actionLog } from "./lib/action-log"
import { runShell } from "./lib/shell-runner"
import { openApp, openUrl } from "./lib/launcher"
import { captureScreen } from "./lib/screen"
import { startProactiveDaemon, getSuggestions } from "./lib/proactive"
import { detectGeminiCli, runGemini, cancelGemini } from "./lib/gemini-cli"
import { detectAntigravity, openInAntigravity } from "./lib/antigravity"
import { projects } from "./lib/projects"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let win: BrowserWindow | null = null
let tray: Tray | null = null
let currentHotkey = "CommandOrControl+Space"

const isDev = !app.isPackaged

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: "#0a0e14",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    frame: process.platform !== "darwin",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // we need preload to do IO
    },
  })

  if (isDev) {
    win.loadURL("http://localhost:3000")
  } else {
    win.loadFile(path.join(__dirname, "../out/index.html"))
  }

  win.once("ready-to-show", () => win?.show())
  win.on("closed", () => {
    win = null
  })
}

function createTray() {
  // Use a simple monochrome dot — replace with a real .ico/.png in production
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)
  tray.setToolTip("Jarvis — Personal AI")
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Show Jarvis", click: () => toggleWindow(true) },
      { label: "Hide", click: () => toggleWindow(false) },
      { type: "separator" },
      { label: `Hotkey: ${currentHotkey}`, enabled: false },
      { type: "separator" },
      { label: "Quit", click: () => app.quit() },
    ]),
  )
  tray.on("click", () => toggleWindow())
}

function toggleWindow(force?: boolean) {
  if (!win) {
    createWindow()
    return
  }
  const shouldShow = force === undefined ? !win.isVisible() : force
  if (shouldShow) {
    win.show()
    win.focus()
  } else {
    win.hide()
  }
}

function registerHotkey(accelerator: string) {
  globalShortcut.unregisterAll()
  currentHotkey = accelerator
  try {
    globalShortcut.register(accelerator, () => toggleWindow())
  } catch (err) {
    console.error("Failed to register hotkey", err)
  }
}

function wireIPC() {
  ipcMain.handle("jarvis:status", async () => ({
    ollamaOnline: await ollamaStatus().then((s) => s.online).catch(() => false),
    ollamaModel: process.env.OLLAMA_MODEL ?? "llama3.2",
    memoryCount: memory.count(),
    actionsToday: actionLog.countToday(),
    cpu: process.getCPUUsage().percentCPUUsage * 100,
    ram: (process.memoryUsage().rss / (1024 * 1024 * 1024)) * 10, // rough %
    isElectron: true,
  }))

  ipcMain.handle("jarvis:chat", async (_e, messages) => {
    // Recall relevant memories first
    const recalled = memory.recall(messages.at(-1)?.content ?? "", 5)
    return ollamaChat(messages, { recalled })
  })

  ipcMain.handle("jarvis:runShell", async (_e, cmd: string, opts) => {
    return runShell(cmd, opts)
  })

  ipcMain.handle("jarvis:openApp", async (_e, name: string) => openApp(name))
  ipcMain.handle("jarvis:openUrl", async (_e, url: string) => openUrl(url))

  ipcMain.handle("jarvis:captureScreen", async () => captureScreen())

  ipcMain.handle("jarvis:listActions", async () => actionLog.list())
  ipcMain.handle("jarvis:revertAction", async (_e, id: string) => actionLog.revert(id))

  ipcMain.handle("jarvis:listMemories", async (_e, q?: string) => memory.list(q))
  ipcMain.handle("jarvis:writeMemory", async (_e, m) => memory.write(m))

  ipcMain.handle("jarvis:getSuggestions", async () => getSuggestions())

  ipcMain.handle("jarvis:setHotkey", async (_e, accel: string) => {
    registerHotkey(accel)
  })

  // ---- Coding / Antigravity ------------------------------------------------
  ipcMain.handle("jarvis:codingTooling", async () => {
    const g = await detectGeminiCli()
    const a = detectAntigravity(null)
    return {
      geminiCliInstalled: g.installed,
      geminiCliVersion: g.version,
      geminiAuthed: g.authed,
      geminiModel: process.env.GEMINI_MODEL ?? "gemini-3-pro",
      antigravityInstalled: a.installed,
      antigravityPath: a.path,
      projectsRoot: projects.root(),
    }
  })

  ipcMain.handle("jarvis:listProjects", async () => projects.list())
  ipcMain.handle("jarvis:createProject", async (_e, input) => projects.create(input))
  ipcMain.handle("jarvis:listProjectFiles", async (_e, id: string) => projects.files(id))
  ipcMain.handle("jarvis:readProjectFile", async (_e, id: string, rel: string) => projects.readFile(id, rel))

  ipcMain.handle("jarvis:cancelCodeRun", async (_e, runId: string) => cancelGemini(runId))

  ipcMain.handle("jarvis:openInAntigravity", async (_e, id: string) => {
    const p = projects.get(id)
    if (!p) return { ok: false, error: "Project not found" }
    return openInAntigravity(p.path, null)
  })

  ipcMain.handle("jarvis:openProjectFolder", async (_e, id: string) => {
    const p = projects.get(id)
    if (p) shell.openPath(p.path).catch(() => {})
  })

  // generateCode uses an event channel so we can stream chunks back
  ipcMain.handle(
    "jarvis:generateCode",
    async (e, input: { projectId: string; prompt: string; model?: string; channel: string }) => {
      const proj = projects.get(input.projectId)
      const channel = input.channel
      if (!proj) {
        e.sender.send(channel, { type: "error", message: "Project not found" })
        return { status: "failed", runId: "x" }
      }
      const runId = `r_${Math.random().toString(36).slice(2, 10)}`
      const start = Date.now()
      e.sender.send(channel, { type: "start", project: proj, runId, model: input.model ?? "gemini-3-pro" })
      const emit = (ev: any) => e.sender.send(channel, ev)

      const cli = await detectGeminiCli()
      if (!cli.installed) {
        emit({
          type: "error",
          message:
            "Gemini CLI is not installed. Install with `npm i -g @google/gemini-cli` then run `gemini` once to authenticate.",
        })
        emit({ type: "done", runId, status: "failed", durationMs: Date.now() - start, filesChanged: 0 })
        return { status: "failed", runId }
      }
      if (!cli.authed) {
        emit({
          type: "error",
          message: "Gemini CLI is installed but not authenticated. Open a terminal and run `gemini` to sign in with your Google account.",
        })
        emit({ type: "done", runId, status: "failed", durationMs: Date.now() - start, filesChanged: 0 })
        return { status: "failed", runId }
      }

      const result = await runGemini({
        runId,
        cwd: proj.path,
        prompt: input.prompt,
        model: input.model ?? "gemini-3-pro",
        emit,
      })

      projects.touch(proj.id)
      emit({
        type: "done",
        runId,
        status: result.status,
        durationMs: Date.now() - start,
        filesChanged: result.filesChanged,
      })
      // Log it as an action so it shows up in /log alongside everything else
      await actionLog
        .write({
          kind: "shell",
          summary: `Cooked code in ${proj.name} via Gemini CLI`,
          payload: { project: proj.name, prompt: input.prompt, filesChanged: result.filesChanged },
          revertData: null,
        })
        .catch(() => {})

      return { status: result.status, runId }
    },
  )
}

app.whenReady().then(async () => {
  await memory.init()
  await actionLog.init()
  wireIPC()
  createWindow()
  createTray()
  registerHotkey(currentHotkey)
  startProactiveDaemon()

  // Open external URLs in the system browser, not inside the Electron window
  app.on("web-contents-created", (_, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url)
      return { action: "deny" }
    })
  })
})

app.on("window-all-closed", () => {
  // Stay alive in tray on Windows/Linux too — Jarvis is a background companion
  if (process.platform === "darwin") return
  // Don't quit; keep the tray alive
})

app.on("will-quit", () => {
  globalShortcut.unregisterAll()
})

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
