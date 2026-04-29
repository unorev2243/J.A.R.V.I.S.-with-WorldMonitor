/**
 * Ollama client — talks to a local Ollama server at http://127.0.0.1:11434.
 * Install Ollama once at https://ollama.com and run `ollama pull llama3.2`.
 */

const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434"
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || "llama3.2"

const SYSTEM = `You are Jarvis — a personal AI assistant for the user.
You are concise, direct, and act like a partner, not a chatbot.
You have full access to the user's PC: shell, files, apps, screen, VPN.
You always cross-reference what you remember about the user before acting.
You NEVER touch financial systems (you can read balances, never move money).
You NEVER install from suspicious or unsigned sources.
You confirm destructive actions, and log everything for one-click revert.
When the user asks you to do something on their machine, describe what you're
about to do in one short sentence, then say "ok?" — unless they've pre-approved
that class of action in Settings.`

export async function ollamaStatus(): Promise<{ online: boolean; models: string[] }> {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(1500) })
    if (!r.ok) return { online: false, models: [] }
    const data = (await r.json()) as { models?: { name: string }[] }
    return { online: true, models: (data.models ?? []).map((m) => m.name) }
  } catch {
    return { online: false, models: [] }
  }
}

export async function ollamaChat(
  messages: { role: string; content: string }[],
  ctx: { recalled?: { content: string }[] } = {},
): Promise<string> {
  const recallBlock =
    ctx.recalled?.length
      ? `\n\nRELEVANT MEMORIES:\n${ctx.recalled.map((m, i) => `(${i + 1}) ${m.content}`).join("\n")}`
      : ""

  const payload = {
    model: DEFAULT_MODEL,
    messages: [
      { role: "system", content: SYSTEM + recallBlock },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
    stream: false,
  }

  try {
    const r = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!r.ok) throw new Error(`ollama ${r.status}`)
    const data = (await r.json()) as { message?: { content?: string } }
    return data.message?.content ?? ""
  } catch (err: any) {
    return `[Ollama unavailable: ${err.message}]\n\nMake sure Ollama is running and you have pulled a model:\n  $ ollama pull ${DEFAULT_MODEL}\n  $ ollama serve`
  }
}
