// Shared types between renderer (Next.js UI) and Electron main process.

export type ChatRole = "user" | "assistant" | "system"

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  createdAt: number
}

export type ActionStatus = "pending" | "success" | "failed" | "reverted"

export type ActionKind =
  | "shell"
  | "file.write"
  | "file.delete"
  | "file.move"
  | "app.open"
  | "browser.open"
  | "vpn.toggle"
  | "install"
  | "screen.note"
  | "memory.write"
  | "integration.call"

export interface ActionLogEntry {
  id: string
  kind: ActionKind
  summary: string
  /** Command, path, or payload that was executed */
  payload: Record<string, unknown>
  /** Snapshot needed to revert this action (e.g. previous file contents) */
  revertData: Record<string, unknown> | null
  status: ActionStatus
  createdAt: number
  completedAt?: number
  error?: string
}

export interface MemoryEntry {
  id: string
  kind: "fact" | "preference" | "screen-note" | "conversation"
  content: string
  source?: string
  importance: number // 0–1
  createdAt: number
  /** Optional embedding for semantic recall */
  embedding?: number[]
}

export interface ProactiveSuggestion {
  id: string
  title: string
  detail: string
  cta?: string
  createdAt: number
}

export interface SystemStatus {
  ollamaOnline: boolean
  ollamaModel: string | null
  memoryCount: number
  actionsToday: number
  cpu: number
  ram: number
  isElectron: boolean
}

// ---- Coding / Antigravity ----------------------------------------------------

export type CodeRunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled"

export interface CodeProject {
  id: string
  name: string
  /** Absolute path on disk in the desktop build, virtual id in the web mock */
  path: string
  language: string
  prompt: string
  createdAt: number
  lastRunAt?: number
  fileCount: number
}

export interface CodeFile {
  path: string // relative to project root
  bytes: number
  language: string
  preview?: string
}

/**
 * Streaming events emitted while Gemini CLI cooks code in a project folder.
 * Mirrored 1:1 between web mock and Electron real impl.
 */
export type CodeRunEvent =
  | { type: "start"; project: CodeProject; runId: string; model: string }
  | { type: "thought"; text: string }
  | { type: "stdout"; chunk: string }
  | { type: "file"; path: string; status: "created" | "modified" | "deleted"; bytes: number }
  | { type: "shell"; cmd: string }
  | { type: "done"; runId: string; status: CodeRunStatus; durationMs: number; filesChanged: number }
  | { type: "error"; message: string }

export interface CodingTooling {
  geminiCliInstalled: boolean
  geminiCliVersion: string | null
  geminiAuthed: boolean
  geminiModel: string
  antigravityInstalled: boolean
  antigravityPath: string | null
  projectsRoot: string
}

export interface JarvisAPI {
  isElectron: () => boolean
  status: () => Promise<SystemStatus>
  chat: (messages: ChatMessage[]) => Promise<string>
  chatStream: (messages: ChatMessage[], onToken: (t: string) => void) => Promise<string>
  runShell: (cmd: string, opts?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; code: number }>
  openApp: (name: string) => Promise<void>
  openUrl: (url: string) => Promise<void>
  captureScreen: () => Promise<{ dataUrl: string }>
  listActions: () => Promise<ActionLogEntry[]>
  revertAction: (id: string) => Promise<void>
  listMemories: (q?: string) => Promise<MemoryEntry[]>
  writeMemory: (m: Omit<MemoryEntry, "id" | "createdAt">) => Promise<MemoryEntry>
  getSuggestions: () => Promise<ProactiveSuggestion[]>
  setHotkey: (accelerator: string) => Promise<void>

  // Coding / Antigravity ------------------------------------------------------
  codingTooling: () => Promise<CodingTooling>
  listProjects: () => Promise<CodeProject[]>
  createProject: (input: { name: string; prompt: string; language?: string }) => Promise<CodeProject>
  listProjectFiles: (projectId: string) => Promise<CodeFile[]>
  readProjectFile: (projectId: string, relativePath: string) => Promise<string>
  /**
   * Generate / edit code with Gemini CLI inside the project folder.
   * Streams events. Returns final status.
   */
  generateCode: (
    input: { projectId: string; prompt: string; model?: string },
    onEvent: (e: CodeRunEvent) => void,
  ) => Promise<{ status: CodeRunStatus; runId: string }>
  cancelCodeRun: (runId: string) => Promise<void>
  openInAntigravity: (projectId: string) => Promise<void>
  openProjectFolder: (projectId: string) => Promise<void>
}
