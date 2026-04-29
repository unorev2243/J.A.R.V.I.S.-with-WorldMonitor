/**
 * Project registry — persists Jarvis-managed code projects and their metadata
 * to ~/JarvisProjects/.jarvis/projects.json. Files themselves live in the
 * project folder; we just track the catalog.
 */

import { app } from "electron"
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, readdirSync } from "node:fs"
import path from "node:path"
import os from "node:os"
import type { CodeFile, CodeProject } from "../../lib/types"

function rootDir(): string {
  // %USERPROFILE%/JarvisProjects on Windows, ~/JarvisProjects on mac/linux
  return path.join(os.homedir(), "JarvisProjects")
}

function dbPath(): string {
  const dir = path.join(rootDir(), ".jarvis")
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return path.join(dir, "projects.json")
}

function load(): CodeProject[] {
  try {
    const raw = readFileSync(dbPath(), "utf8")
    return JSON.parse(raw) as CodeProject[]
  } catch {
    return []
  }
}

function save(projects: CodeProject[]): void {
  writeFileSync(dbPath(), JSON.stringify(projects, null, 2), "utf8")
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `project-${Date.now().toString(36)}`
}

export const projects = {
  root: rootDir,

  list(): CodeProject[] {
    const xs = load()
    // Heal any moved/deleted folders by recomputing fileCount
    for (const p of xs) p.fileCount = countFiles(p.path)
    return xs.sort((a, b) => (b.lastRunAt ?? b.createdAt) - (a.lastRunAt ?? a.createdAt))
  },

  get(id: string): CodeProject | undefined {
    return load().find((p) => p.id === id)
  },

  create(input: { name: string; prompt: string; language?: string }): CodeProject {
    if (!existsSync(rootDir())) mkdirSync(rootDir(), { recursive: true })
    const slug = slugify(input.name)
    const dir = path.join(rootDir(), slug)
    mkdirSync(dir, { recursive: true })
    const proj: CodeProject = {
      id: `p_${Math.random().toString(36).slice(2, 10)}`,
      name: input.name,
      path: dir,
      language: input.language ?? "auto",
      prompt: input.prompt,
      createdAt: Date.now(),
      fileCount: 0,
    }
    const all = load()
    all.unshift(proj)
    save(all)
    return proj
  },

  touch(id: string): void {
    const all = load()
    const p = all.find((x) => x.id === id)
    if (!p) return
    p.lastRunAt = Date.now()
    p.fileCount = countFiles(p.path)
    save(all)
  },

  files(id: string): CodeFile[] {
    const p = this.get(id)
    if (!p || !existsSync(p.path)) return []
    const out: CodeFile[] = []
    walk(p.path, p.path, out, 0)
    return out
  },

  readFile(id: string, rel: string): string {
    const p = this.get(id)
    if (!p) return ""
    const full = path.join(p.path, rel)
    if (!full.startsWith(p.path)) return "" // path traversal guard
    try {
      return readFileSync(full, "utf8")
    } catch {
      return ""
    }
  },
}

function countFiles(root: string): number {
  if (!existsSync(root)) return 0
  let n = 0
  const stack = [root]
  while (stack.length) {
    const d = stack.pop()!
    let entries: string[] = []
    try {
      entries = readdirSync(d)
    } catch {
      continue
    }
    for (const name of entries) {
      if (name === "node_modules" || name === ".git" || name === ".venv") continue
      const f = path.join(d, name)
      let s
      try {
        s = statSync(f)
      } catch {
        continue
      }
      if (s.isDirectory()) stack.push(f)
      else n++
    }
  }
  return n
}

function walk(root: string, dir: string, out: CodeFile[], depth: number): void {
  if (depth > 6) return
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
    const rel = path.relative(root, full).replace(/\\/g, "/")
    if (s.isDirectory()) walk(root, full, out, depth + 1)
    else
      out.push({
        path: rel,
        bytes: s.size,
        language: extLang(name),
      })
  }
}

function extLang(name: string): string {
  const ext = path.extname(name).slice(1).toLowerCase()
  if (["ts", "tsx"].includes(ext)) return "typescript"
  if (["js", "jsx", "mjs", "cjs"].includes(ext)) return "javascript"
  if (ext === "py") return "python"
  if (ext === "rs") return "rust"
  if (ext === "go") return "go"
  if (ext === "md") return "markdown"
  if (ext === "json") return "json"
  if (ext === "toml") return "toml"
  if (ext === "yaml" || ext === "yml") return "yaml"
  return ext || "text"
}
