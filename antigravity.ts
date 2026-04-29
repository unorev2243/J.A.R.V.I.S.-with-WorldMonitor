/**
 * Antigravity launcher.
 *
 * Antigravity is a VS Code fork. On Windows the installer drops:
 *   %LOCALAPPDATA%\Programs\Antigravity\Antigravity.exe
 *   %LOCALAPPDATA%\Programs\Antigravity\bin\antigravity.cmd
 *
 * We detect either, and launch with the project folder as the first arg —
 * exactly like `code <folder>` opens VS Code on a workspace.
 *
 * If the user has a custom install path, it's stored in settings and overrides
 * detection.
 */

import { existsSync } from "node:fs"
import { spawn } from "node:child_process"
import path from "node:path"
import os from "node:os"
import { shell } from "electron"

export interface AntigravityInfo {
  installed: boolean
  path: string | null
}

const WIN_CANDIDATES = [
  () => path.join(process.env.LOCALAPPDATA ?? "", "Programs", "Antigravity", "bin", "antigravity.cmd"),
  () => path.join(process.env.LOCALAPPDATA ?? "", "Programs", "Antigravity", "Antigravity.exe"),
  () => path.join(process.env.PROGRAMFILES ?? "", "Antigravity", "Antigravity.exe"),
  () => path.join(process.env.PROGRAMFILES ?? "", "Google", "Antigravity", "Antigravity.exe"),
]

const MAC_CANDIDATES = [
  () => "/Applications/Antigravity.app/Contents/Resources/app/bin/antigravity",
  () => "/Applications/Antigravity.app/Contents/MacOS/Antigravity",
]

const LINUX_CANDIDATES = [
  () => "/usr/bin/antigravity",
  () => "/usr/local/bin/antigravity",
  () => path.join(os.homedir(), ".local/bin/antigravity"),
]

export function detectAntigravity(overridePath?: string | null): AntigravityInfo {
  if (overridePath && existsSync(overridePath)) return { installed: true, path: overridePath }
  const candidates =
    process.platform === "win32" ? WIN_CANDIDATES : process.platform === "darwin" ? MAC_CANDIDATES : LINUX_CANDIDATES
  for (const get of candidates) {
    const p = get()
    if (p && existsSync(p)) return { installed: true, path: p }
  }
  return { installed: false, path: null }
}

export function openInAntigravity(projectPath: string, overridePath?: string | null): { ok: boolean; error?: string } {
  const info = detectAntigravity(overridePath)
  if (!info.installed || !info.path) {
    // Fall back to opening the folder in the system file manager
    shell.openPath(projectPath).catch(() => {})
    return { ok: false, error: "Antigravity is not installed. Opened project folder in file manager instead." }
  }
  try {
    spawn(info.path, [projectPath], { detached: true, stdio: "ignore", shell: process.platform === "win32" })
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Failed to launch Antigravity" }
  }
}
