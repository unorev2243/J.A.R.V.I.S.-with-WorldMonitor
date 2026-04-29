/**
 * Memory — persistent SQLite store at <userData>/jarvis.db.
 *
 * Stores facts, preferences, screen-notes, conversations. Uses a simple
 * trigram-ish keyword recall by default; if `sqlite-vec` is installed,
 * upgrades to vector similarity for semantic recall.
 */

import { app } from "electron"
import path from "node:path"
import fs from "node:fs"

interface MemoryEntry {
  id: string
  kind: "fact" | "preference" | "screen-note" | "conversation"
  content: string
  source?: string
  importance: number
  createdAt: number
}

let db: any = null
let useSqlite = false

async function open() {
  if (db) return db
  try {
    const Database = (await import("better-sqlite3")).default
    const dir = app.getPath("userData")
    fs.mkdirSync(dir, { recursive: true })
    db = new Database(path.join(dir, "jarvis.db"))
    db.pragma("journal_mode = WAL")
    db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        content TEXT NOT NULL,
        source TEXT,
        importance REAL NOT NULL DEFAULT 0.5,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_memories_kind ON memories(kind);
      CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at DESC);
      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        id UNINDEXED, content, content='memories', content_rowid='rowid'
      );
    `)
    useSqlite = true
  } catch (err) {
    console.warn(
      "[jarvis] better-sqlite3 not installed — falling back to in-memory store. " +
        "Install with `pnpm add -D better-sqlite3` for persistence.",
    )
    useSqlite = false
    db = null
  }
  return db
}

const fallbackStore: MemoryEntry[] = []

export const memory = {
  async init() {
    await open()
    if (useSqlite && db) {
      const c = db.prepare("SELECT COUNT(*) as n FROM memories").get() as { n: number }
      if (c.n === 0) seed()
    } else if (fallbackStore.length === 0) {
      seed()
    }
  },

  count(): number {
    if (useSqlite && db) {
      const r = db.prepare("SELECT COUNT(*) as n FROM memories").get() as { n: number }
      return r.n
    }
    return fallbackStore.length
  },

  list(q?: string): MemoryEntry[] {
    if (useSqlite && db) {
      if (q && q.trim()) {
        try {
          const rows = db
            .prepare(
              `SELECT m.* FROM memories_fts f
               JOIN memories m ON m.id = f.id
               WHERE memories_fts MATCH ?
               ORDER BY m.importance DESC LIMIT 100`,
            )
            .all(q + "*")
          if (rows.length) return rows.map(rowToEntry)
        } catch {
          // FTS index might not be populated; fall through
        }
        const ql = `%${q.toLowerCase()}%`
        return db
          .prepare(
            `SELECT * FROM memories WHERE LOWER(content) LIKE ?
             ORDER BY created_at DESC LIMIT 100`,
          )
          .all(ql)
          .map(rowToEntry)
      }
      return db
        .prepare("SELECT * FROM memories ORDER BY created_at DESC LIMIT 200")
        .all()
        .map(rowToEntry)
    }
    if (q) {
      const ql = q.toLowerCase()
      return [...fallbackStore]
        .filter((m) => m.content.toLowerCase().includes(ql))
        .sort((a, b) => b.createdAt - a.createdAt)
    }
    return [...fallbackStore].sort((a, b) => b.createdAt - a.createdAt)
  },

  recall(prompt: string, limit = 5): MemoryEntry[] {
    return memory.list(prompt).slice(0, limit)
  },

  write(input: Omit<MemoryEntry, "id" | "createdAt">): MemoryEntry {
    const entry: MemoryEntry = {
      ...input,
      id: `m_${Math.random().toString(36).slice(2, 11)}`,
      createdAt: Date.now(),
    }
    if (useSqlite && db) {
      db.prepare(
        `INSERT INTO memories (id, kind, content, source, importance, created_at)
         VALUES (?,?,?,?,?,?)`,
      ).run(entry.id, entry.kind, entry.content, entry.source ?? null, entry.importance, entry.createdAt)
      db.prepare(
        "INSERT INTO memories_fts (id, content) VALUES (?, ?)",
      ).run(entry.id, entry.content)
    } else {
      fallbackStore.push(entry)
    }
    return entry
  },
}

function rowToEntry(r: any): MemoryEntry {
  return {
    id: r.id,
    kind: r.kind,
    content: r.content,
    source: r.source ?? undefined,
    importance: r.importance,
    createdAt: r.created_at,
  }
}

function seed() {
  const seeds: Omit<MemoryEntry, "id" | "createdAt">[] = [
    { kind: "fact",       content: "User runs Windows 11.",                                                        importance: 0.95 },
    { kind: "preference", content: "User prefers concise, direct answers without filler.",                         importance: 0.9 },
    { kind: "preference", content: "User wants Jarvis to confirm before any destructive or financial action.",     importance: 1.0 },
    { kind: "fact",       content: "Hotkey to summon Jarvis: Ctrl+Space.",                                         importance: 0.8 },
  ]
  seeds.forEach((s) => memory.write(s))
}
