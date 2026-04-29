/**
 * Proactive daemon — runs in the background, generates suggestions.
 *
 * Pluggable sources:
 *  - calendar       → upcoming events / conflicts
 *  - screen-notes   → patterns in what the user is looking at
 *  - location       → entering new wifi → suggest VPN
 *  - habit          → "you usually start standup at 9am — want me to open Slack?"
 */

interface Suggestion {
  id: string
  title: string
  detail: string
  cta?: string
  createdAt: number
}

let suggestions: Suggestion[] = []
let timer: NodeJS.Timeout | null = null

export function startProactiveDaemon() {
  if (timer) return
  // Seed once
  refresh()
  // Re-evaluate every 2 minutes
  timer = setInterval(refresh, 1000 * 60 * 2)
}

export function getSuggestions(): Suggestion[] {
  return suggestions
}

function refresh() {
  // In a real build, query: calendar API, screen-monitor notes, network state.
  // For now we mock context-aware suggestions so the UI has something to show.
  const now = Date.now()
  const next: Suggestion[] = []

  next.push({
    id: "s_dentist",
    title: "Dentist appointment Friday at 2pm",
    detail: "Want me to set a reminder 1h before and pre-load directions?",
    cta: "Set reminder",
    createdAt: now,
  })

  next.push({
    id: "s_screen",
    title: "You spent 2h on Tokio async docs earlier",
    detail: "I summarized the runtime section into 6 bullets. Want them saved to memory?",
    cta: "Save notes",
    createdAt: now,
  })

  // Network-aware: if we detect a new wifi network and VPN is off, suggest it
  next.push({
    id: "s_vpn",
    title: "VPN is off",
    detail: "Recommended on public networks. I will not auto-toggle without confirmation.",
    cta: "Turn on VPN",
    createdAt: now,
  })

  suggestions = next
}
