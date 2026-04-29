/**
 * Gemini CLI wrapper.
 *
 * Spawns the official `gemini` binary in a project folder and streams its
 * stdout/stderr back to the renderer as `CodeRunEvent`s.
 *
 * Auth: the `gemini` CLI handles OAuth via Gmail account on first run
 * (free tier: 1000 reqs/day with Gemini 3 Pro/Flash). We never see the token.
 *
 * Install: `npm i -g @google/gemini-cli` or follow the official guide.
 *  https://github.com/google-gemini/gemini-cli
 */

import { spawn, type ChildProcess } from "node:child_process"
import { existsSync, statSync, readdirSync } from "node:fs"
import path from "node:path"
import { promisify } from "node:util"
import { exec } from "node:child_process"

const execP = promisify(exec)

type EmitFn = (e: any) => void

export interface GeminiCliInfo {
  installed: boolean
  version: string | null
  authed: boolean
  binary: string
}

export async function detectGeminiCli(): Promise<GeminiCliInfo> {
  const binary = process.platform === "win32" ? "gemini.cmd" : "gemini"
  try {
    const { stdout } = await execP(`${binary} --version`, { timeout: 4000 })
    const version = stdout.trim().split(/\s+/).pop() ?? null
    let authed = false
    try {
      // `gemini auth status` prints "logged in as ..." when authed
      const { stdout: a } = await execP(`${binary} auth status`, { timeout: 4000 })
      authed = /logged in|authenticated/i.test(a)
    } catch {
      authed = false
    }
    return { installed: true, version, authed, binary }
  } catch {
    return { installed: false, version: null, authed: false, binary }
  }
}

const activeRuns = new Map<string, ChildProcess>()

export interface RunOptions {
  runId: string
  cwd: string
  prompt: string
  model?: string
  emit: EmitFn
}

/**
 * Run gemini CLI in non-interactive mode and emit structured events.
 *
 * Strategy: snapshot the project folder before, run gemini, snapshot after,
 * and diff to emit `file` events. We also pipe stdout chunk-by-chunk for the
 * live "thinking aloud" feel.
 */
export async function runGemini({ runId, cwd, prompt, model = "gemini-3-pro", emit }: RunOptions): Promise<{
  status: "succeeded" | "failed" | "cancelled"
  filesChanged: number
}> {
  const before = snapshot(cwd)

  const binary = process.platform === "win32" ? "gemini.cmd" : "gemini"
  const args = ["--yolo", "--model", model, "-p", prompt]
  // --yolo accepts agent actions without per-step approval; safe inside a fresh project folder.

  return new Promise((resolve) => {
    let child: ChildProcess
    try {
      child = spawn(binary, args, { cwd, shell: process.platform === "win32" })
    } catch (err: any) {
      emit({ type: "error", message: `Could not start gemini CLI: ${err?.message ?? err}` })
      resolve({ status: "failed", filesChanged: 0 })
      return
    }
    activeRuns.set(runId, child)

    child.stdout?.on("data", (b: Buffer) => emit({ type: "stdout", chunk: b.toString("utf8") }))
    child.stderr?.on("data", (b: Buffer) => emit({ type: "stdout", chunk: b.toString("utf8") }))

    child.on("error", (err) => {
      emit({ type: "error", message: err.message })
    })

    child.on("close", (code, signal) => {
      activeRuns.delete(runId)
      const after = snapshot(cwd)
      const diff = diffSnapshots(before, after)
      for (const f of diff.created) emit({ type: "file", path: f.path, status: "created", bytes: f.bytes })
      for (const f of diff.modified) emit({ type: "file", path: f.path, status: "modified", bytes: f.bytes })
      for (const f of diff.deleted) emit({ type: "file", path: f.path, status: "deleted", bytes: 0 })

      const cancelled = signal === "SIGTERM" || signal === "SIGKILL"
      const status = cancelled ? "cancelled" : code === 0 ? "succeeded" : "failed"
      resolve({ status, filesChanged: diff.created.length + diff.modified.length + diff.deleted.length })
    })
  })
}

export function cancelGemini(runId: string): void {
  const c = activeRuns.get(runId)
  if (c) c.kill()
}

// ---- folder snapshot / diff -------------------------------------------------

interface Snap {
  files: Map<string, { bytes: number; mtime: number }>
}

function snapshot(root: string): Snap {
  const files = new Map<string, { bytes: number; mtime: number }>()
  if (!existsSync(root)) return { files }
  walk(root, root, files)
  return { files }
}

function walk(root: string, dir: string, out: Map<string, { bytes: number; mtime: number }>) {
  let entries: string[] = []
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const name of entries) {
    if (name === "node_modules" || name === ".git" || name === ".venv") continue
    const full = path.join(dir, name)
    let s
    try {
      s = statSync(full)
    } catch {
      continue
    }
    if (s.isDirectory()) walk(root, full, out)
    else out.set(path.relative(root, full).replace(/\\/g, "/"), { bytes: s.size, mtime: s.mtimeMs })
  }
}

function diffSnapshots(a: Snap, b: Snap) {
  const created: { path: string; bytes: number }[] = []
  const modified: { path: string; bytes: number }[] = []
  const deleted: { path: string }[] = []
  for (const [k, v] of b.files) {
    const prev = a.files.get(k)
    if (!prev) created.push({ path: k, bytes: v.bytes })
    else if (prev.mtime !== v.mtime || prev.bytes !== v.bytes) modified.push({ path: k, bytes: v.bytes })
  }
  for (const k of a.files.keys()) if (!b.files.has(k)) deleted.push({ path: k })
  return { created, modified, deleted }
}
