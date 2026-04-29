"use client"

/**
 * The Jarvis bridge is the single API the renderer talks to.
 *
 * - In the **Electron desktop app**, `window.electronAPI` is injected by the
 *   preload script (see /electron/preload.ts) and we forward every call to the
 *   real Node.js / Ollama / SQLite implementations in the main process.
 *
 * - In the **v0 web preview** (or any plain-browser context), there is no
 *   `window.electronAPI`, so we fall back to mock responses and the Next.js
 *   API routes under /api/*. This lets you design and demo the UI without
 *   running the desktop app.
 */

import type {
  ActionLogEntry,
  ChatMessage,
  CodeFile,
  CodeProject,
  CodeRunEvent,
  CodingTooling,
  JarvisAPI,
  MemoryEntry,
  ProactiveSuggestion,
  SystemStatus,
} from "./types"

declare global {
  interface Window {
    electronAPI?: JarvisAPI
  }
}

function inElectron(): boolean {
  return typeof window !== "undefined" && !!window.electronAPI
}

const memoryStore: MemoryEntry[] = [
  {
    id: "m_seed_1",
    kind: "preference",
    content: "User prefers concise, direct answers without filler.",
    importance: 0.9,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 12,
  },
  {
    id: "m_seed_2",
    kind: "fact",
    content: "User runs Windows 11. Hotkey to summon Jarvis: Ctrl+Space.",
    importance: 0.95,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 8,
  },
  {
    id: "m_seed_3",
    kind: "screen-note",
    content: "Spent 2h reading about Rust async runtimes (Tokio docs, Tuesday).",
    importance: 0.55,
    createdAt: Date.now() - 1000 * 60 * 60 * 30,
    source: "screen-monitor",
  },
  {
    id: "m_seed_4",
    kind: "fact",
    content: "Calendar: dentist appointment Friday 2pm.",
    importance: 0.7,
    createdAt: Date.now() - 1000 * 60 * 60 * 5,
    source: "calendar",
  },
]

const actionStore: ActionLogEntry[] = [
  {
    id: "a_seed_1",
    kind: "app.open",
    summary: "Opened Visual Studio Code",
    payload: { name: "code" },
    revertData: null,
    status: "success",
    createdAt: Date.now() - 1000 * 60 * 14,
    completedAt: Date.now() - 1000 * 60 * 14,
  },
  {
    id: "a_seed_2",
    kind: "file.write",
    summary: "Created notes.md in ~/Documents",
    payload: { path: "C:/Users/you/Documents/notes.md", bytes: 482 },
    revertData: { previousContents: null },
    status: "success",
    createdAt: Date.now() - 1000 * 60 * 32,
    completedAt: Date.now() - 1000 * 60 * 32,
  },
  {
    id: "a_seed_3",
    kind: "browser.open",
    summary: "Opened WorldMonitor.app dashboard",
    payload: { url: "https://worldmonitor.app" },
    revertData: null,
    status: "success",
    createdAt: Date.now() - 1000 * 60 * 58,
    completedAt: Date.now() - 1000 * 60 * 58,
  },
]

const mockApi: JarvisAPI = {
  isElectron: () => false,
  async status(): Promise<SystemStatus> {
    return {
      ollamaOnline: false,
      ollamaModel: null,
      memoryCount: memoryStore.length,
      actionsToday: actionStore.length,
      cpu: 14 + Math.random() * 12,
      ram: 38 + Math.random() * 8,
      isElectron: false,
    }
  },
  async chat(messages: ChatMessage[]): Promise<string> {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages }),
    })
    if (!res.ok) throw new Error("chat failed")
    const data = await res.json()
    return data.text as string
  },
  async chatStream(messages, onToken) {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify({ messages, stream: true }),
    })
    if (!res.body) throw new Error("no stream")
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let full = ""
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      full += chunk
      onToken(chunk)
    }
    return full
  },
  async runShell(cmd) {
    return {
      stdout: `[mock] would run: ${cmd}\n(connect via Electron desktop app for real shell access)`,
      stderr: "",
      code: 0,
    }
  },
  async openApp(name) {
    console.log("[v0] mock openApp", name)
  },
  async openUrl(url) {
    if (typeof window !== "undefined") window.open(url, "_blank")
  },
  async captureScreen() {
    return {
      dataUrl:
        "data:image/svg+xml;utf8," +
        encodeURIComponent(
          `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='450'><rect width='100%' height='100%' fill='#0a0e14'/><text x='50%' y='50%' fill='#6ec3e6' font-family='monospace' font-size='18' text-anchor='middle'>screen capture available in desktop app</text></svg>`,
        ),
    }
  },
  async listActions() {
    return [...actionStore].sort((a, b) => b.createdAt - a.createdAt)
  },
  async revertAction(id) {
    const a = actionStore.find((x) => x.id === id)
    if (a) a.status = "reverted"
  },
  async listMemories(q) {
    if (!q) return [...memoryStore].sort((a, b) => b.createdAt - a.createdAt)
    const ql = q.toLowerCase()
    return memoryStore.filter((m) => m.content.toLowerCase().includes(ql))
  },
  async writeMemory(m) {
    const entry: MemoryEntry = {
      ...m,
      id: `m_${Math.random().toString(36).slice(2, 9)}`,
      createdAt: Date.now(),
    }
    memoryStore.push(entry)
    return entry
  },
  async getSuggestions(): Promise<ProactiveSuggestion[]> {
    return [
      {
        id: "s1",
        title: "You have a dentist appointment Friday 2pm",
        detail: "Want me to set a reminder 1h before and route directions?",
        cta: "Set reminder",
        createdAt: Date.now() - 1000 * 60 * 12,
      },
      {
        id: "s2",
        title: "Rust Tokio docs you skimmed earlier",
        detail: "I summarized the async runtime section. Want the notes?",
        cta: "Show notes",
        createdAt: Date.now() - 1000 * 60 * 38,
      },
      {
        id: "s3",
        title: "VPN is off, but you opened a public Wi-Fi network",
        detail: "Recommend turning on the VPN. I will not auto-toggle without confirmation.",
        cta: "Turn on VPN",
        createdAt: Date.now() - 1000 * 60 * 4,
      },
    ]
  },
  async setHotkey(accel) {
    console.log("[v0] mock setHotkey", accel)
  },

  // ---- Coding / Antigravity (web preview mocks) -----------------------------
  async codingTooling(): Promise<CodingTooling> {
    return {
      geminiCliInstalled: false,
      geminiCliVersion: null,
      geminiAuthed: false,
      geminiModel: "gemini-3-pro",
      antigravityInstalled: false,
      antigravityPath: null,
      projectsRoot: "C:/Users/you/JarvisProjects",
    }
  },
  async listProjects(): Promise<CodeProject[]> {
    return projectStore.slice().sort((a, b) => (b.lastRunAt ?? b.createdAt) - (a.lastRunAt ?? a.createdAt))
  },
  async createProject({ name, prompt, language }) {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || `project-${Math.random().toString(36).slice(2, 6)}`
    const proj: CodeProject = {
      id: `p_${Math.random().toString(36).slice(2, 9)}`,
      name,
      path: `C:/Users/you/JarvisProjects/${slug}`,
      language: language ?? guessLang(prompt),
      prompt,
      createdAt: Date.now(),
      fileCount: 0,
    }
    projectStore.unshift(proj)
    return proj
  },
  async listProjectFiles(projectId) {
    return projectFiles[projectId] ?? []
  },
  async readProjectFile(projectId, relativePath) {
    const f = (projectFiles[projectId] ?? []).find((x) => x.path === relativePath)
    return f?.preview ?? `// (web preview) contents of ${relativePath} are only available in the desktop build`
  },
  async generateCode({ projectId, prompt, model = "gemini-3-pro" }, onEvent) {
    const proj = projectStore.find((p) => p.id === projectId)
    if (!proj) {
      onEvent({ type: "error", message: "Project not found" })
      return { status: "failed", runId: "x" }
    }
    const runId = `r_${Math.random().toString(36).slice(2, 9)}`
    const start = Date.now()
    onEvent({ type: "start", project: proj, runId, model })
    await sleep(280)

    const lang = proj.language
    const planned = mockPlan(prompt, lang)
    onEvent({ type: "thought", text: `Planning ${planned.length} files for: ${prompt.slice(0, 80)}` })
    await sleep(220)

    let bytes = 0
    for (const f of planned) {
      onEvent({ type: "thought", text: `Drafting ${f.path}` })
      await sleep(180)
      // stream the file contents in chunks for a live "writing" effect
      const chunks = chunkText(f.preview ?? "", 60)
      for (const c of chunks) {
        onEvent({ type: "stdout", chunk: c })
        await sleep(28)
      }
      onEvent({ type: "file", path: f.path, status: "created", bytes: f.bytes })
      bytes += f.bytes
      await sleep(120)
    }

    if (lang === "python") onEvent({ type: "shell", cmd: "uv init && uv add pygame" })
    if (lang === "typescript" || lang === "javascript") onEvent({ type: "shell", cmd: "pnpm install" })
    await sleep(220)

    projectFiles[projectId] = planned
    proj.fileCount = planned.length
    proj.lastRunAt = Date.now()
    onEvent({ type: "done", runId, status: "succeeded", durationMs: Date.now() - start, filesChanged: planned.length })
    return { status: "succeeded", runId }
  },
  async cancelCodeRun(runId) {
    console.log("[v0] mock cancelCodeRun", runId)
  },
  async openInAntigravity(projectId) {
    const p = projectStore.find((x) => x.id === projectId)
    if (typeof window !== "undefined" && p) {
      // In the web preview we just open Antigravity's website as a hint
      window.open("https://antigravity.google", "_blank")
    }
  },
  async openProjectFolder(projectId) {
    const p = projectStore.find((x) => x.id === projectId)
    console.log("[v0] mock openProjectFolder", p?.path)
  },
}

// ----- mock fixtures + helpers (web preview only) ---------------------------

const projectStore: CodeProject[] = [
  {
    id: "p_seed_snake",
    name: "snake-game",
    path: "C:/Users/you/JarvisProjects/snake-game",
    language: "python",
    prompt: "Build a classic snake game in Python with pygame, scoring, and difficulty levels.",
    createdAt: Date.now() - 1000 * 60 * 60 * 6,
    lastRunAt: Date.now() - 1000 * 60 * 60 * 2,
    fileCount: 4,
  },
  {
    id: "p_seed_todo",
    name: "next-todo",
    path: "C:/Users/you/JarvisProjects/next-todo",
    language: "typescript",
    prompt: "Next.js todo app with localStorage and dark mode toggle.",
    createdAt: Date.now() - 1000 * 60 * 60 * 26,
    lastRunAt: Date.now() - 1000 * 60 * 60 * 22,
    fileCount: 7,
  },
]

const projectFiles: Record<string, CodeFile[]> = {
  p_seed_snake: [
    {
      path: "main.py",
      bytes: 1280,
      language: "python",
      preview:
        "import pygame, random\nfrom config import WIDTH, HEIGHT, FPS\nfrom snake import Snake\n\ndef main():\n    pygame.init()\n    screen = pygame.display.set_mode((WIDTH, HEIGHT))\n    clock = pygame.time.Clock()\n    snake = Snake()\n    running = True\n    while running:\n        for e in pygame.event.get():\n            if e.type == pygame.QUIT:\n                running = False\n        snake.update()\n        screen.fill((10, 14, 20))\n        snake.draw(screen)\n        pygame.display.flip()\n        clock.tick(FPS)\n\nif __name__ == '__main__':\n    main()\n",
    },
    {
      path: "snake.py",
      bytes: 740,
      language: "python",
      preview:
        "import pygame\nfrom config import CELL\n\nclass Snake:\n    def __init__(self):\n        self.body = [(5, 5), (4, 5), (3, 5)]\n        self.dir = (1, 0)\n    def update(self):\n        head = (self.body[0][0] + self.dir[0], self.body[0][1] + self.dir[1])\n        self.body = [head] + self.body[:-1]\n    def draw(self, s):\n        for (x, y) in self.body:\n            pygame.draw.rect(s, (110, 195, 230), (x*CELL, y*CELL, CELL-1, CELL-1))\n",
    },
    { path: "config.py", bytes: 96, language: "python", preview: "WIDTH = 640\nHEIGHT = 480\nFPS = 12\nCELL = 20\n" },
    { path: "README.md", bytes: 220, language: "markdown", preview: "# Snake\n\nA tiny pygame snake game.\n\n## Run\n\n```\nuv run main.py\n```\n" },
  ],
}

function guessLang(prompt: string): string {
  const p = prompt.toLowerCase()
  if (/\b(next\.?js|react|tsx?|typescript)\b/.test(p)) return "typescript"
  if (/\b(node|javascript|express)\b/.test(p)) return "javascript"
  if (/\b(rust|cargo)\b/.test(p)) return "rust"
  if (/\b(go(lang)?)\b/.test(p)) return "go"
  if (/\b(python|pygame|fastapi|flask)\b/.test(p)) return "python"
  return "typescript"
}

function chunkText(s: string, n: number): string[] {
  const out: string[] = []
  for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n))
  return out
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

function mockPlan(prompt: string, lang: string): CodeFile[] {
  const p = prompt.toLowerCase()
  if (lang === "python") {
    if (p.includes("snake") || p.includes("pygame")) {
      return projectFiles.p_seed_snake!
    }
    return [
      {
        path: "main.py",
        bytes: 460,
        language: "python",
        preview:
          "# Generated by Jarvis via Gemini CLI\n\ndef main() -> None:\n    print('hello from your jarvis-cooked python project')\n\nif __name__ == '__main__':\n    main()\n",
      },
      { path: "pyproject.toml", bytes: 120, language: "toml", preview: "[project]\nname = \"jarvis-cooked\"\nversion = \"0.1.0\"\n" },
      { path: "README.md", bytes: 180, language: "markdown", preview: `# ${prompt.slice(0, 60)}\n\nGenerated by Jarvis.\n` },
    ]
  }
  if (lang === "rust") {
    return [
      { path: "Cargo.toml", bytes: 110, language: "toml", preview: "[package]\nname = \"jarvis-cooked\"\nversion = \"0.1.0\"\nedition = \"2021\"\n" },
      { path: "src/main.rs", bytes: 90, language: "rust", preview: "fn main() {\n    println!(\"hello from rust\");\n}\n" },
    ]
  }
  // typescript / next.js default
  return [
    {
      path: "package.json",
      bytes: 280,
      language: "json",
      preview: `{\n  "name": "jarvis-cooked",\n  "version": "0.1.0",\n  "private": true,\n  "scripts": { "dev": "next dev", "build": "next build" },\n  "dependencies": { "next": "^16", "react": "^19", "react-dom": "^19" }\n}\n`,
    },
    {
      path: "app/page.tsx",
      bytes: 320,
      language: "typescript",
      preview: `export default function Page() {\n  return (\n    <main className="min-h-screen flex items-center justify-center">\n      <h1>${prompt.slice(0, 60)}</h1>\n    </main>\n  )\n}\n`,
    },
    {
      path: "app/layout.tsx",
      bytes: 240,
      language: "typescript",
      preview: `export default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (<html><body>{children}</body></html>)\n}\n`,
    },
    { path: "README.md", bytes: 180, language: "markdown", preview: `# ${prompt.slice(0, 60)}\n\nGenerated by Jarvis via Gemini CLI.\n` },
  ]
}

export function jarvis(): JarvisAPI {
  if (inElectron()) return window.electronAPI as JarvisAPI
  return mockApi
}

export function isElectronEnv(): boolean {
  return inElectron()
}
