/**
 * Action log — records every action with the data needed to revert it.
 *
 * Examples of revert data:
 *  - file.write     → previous contents (or null if file didn't exist)
 *  - file.delete    → full backup of the deleted file
 *  - file.move      → original path
 *  - app.open       → no revert
 *  - vpn.toggle     → previous on/off state
 *  - install        → uninstall command + file paths to remove
 */

import { app } from "electron"
import path from "node:path"
import fs from "node:fs/promises"

interface ActionEntry {
  id: string
  kind: string
  summary: string
  payload: Record<string, unknown>
  revertData: Record<string, unknown> | null
  status: "pending" | "success" | "failed" | "reverted"
  createdAt: number
  completedAt?: number
  error?: string
}

let store: ActionEntry[] = []
let logPath = ""

export const actionLog = {
  async init() {
    logPath = path.join(app.getPath("userData"), "actions.json")
    try {
      const raw = await fs.readFile(logPath, "utf8")
      store = JSON.parse(raw)
    } catch {
      store = []
    }
  },

  list(): ActionEntry[] {
    return [...store].sort((a, b) => b.createdAt - a.createdAt)
  },

  countToday(): number {
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    return store.filter((a) => a.createdAt >= dayStart.getTime()).length
  },

  async record(input: Omit<ActionEntry, "id" | "createdAt" | "status"> & { status?: ActionEntry["status"] }): Promise<ActionEntry> {
    const entry: ActionEntry = {
      id: `a_${Math.random().toString(36).slice(2, 11)}`,
      createdAt: Date.now(),
      status: input.status ?? "success",
      ...input,
    }
    store.push(entry)
    await persist()
    return entry
  },

  async revert(id: string): Promise<void> {
    const a = store.find((x) => x.id === id)
    if (!a || !a.revertData) return
    try {
      await applyRevert(a)
      a.status = "reverted"
      await persist()
    } catch (err: any) {
      a.error = err?.message
      throw err
    }
  },
}

async function persist() {
  await fs.writeFile(logPath, JSON.stringify(store, null, 2)).catch(() => {})
}

async function applyRevert(a: ActionEntry) {
  const r = a.revertData!
  switch (a.kind) {
    case "file.write": {
      const target = a.payload.path as string
      const prev = r.previousContents as string | null
      if (prev === null) await fs.unlink(target).catch(() => {})
      else await fs.writeFile(target, prev)
      return
    }
    case "file.delete": {
      const target = a.payload.path as string
      const backup = r.backup as string
      await fs.writeFile(target, backup)
      return
    }
    case "file.move": {
      const from = a.payload.to as string
      const to = a.payload.from as string
      await fs.rename(from, to)
      return
    }
    default:
      // No-op for actions that have no revert
      return
  }
}
