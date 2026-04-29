"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity,
  BrainCircuit,
  Code2,
  Globe2,
  History,
  MessageSquareText,
  Plug,
  Settings as SettingsIcon,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"

const NAV: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { href: "/",             label: "Dashboard",     icon: Activity },
  { href: "/chat",         label: "Brainstorm",    icon: MessageSquareText },
  { href: "/code",         label: "Code",          icon: Code2 },
  { href: "/monitor",      label: "World Monitor", icon: Globe2 },
  { href: "/log",          label: "Action Log",    icon: History },
  { href: "/memory",       label: "Memory",        icon: BrainCircuit },
  { href: "/integrations", label: "Integrations",  icon: Plug },
  { href: "/settings",     label: "Settings",      icon: SettingsIcon },
]

export function Sidebar() {
  const path = usePathname()
  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-4 h-14 border-b border-sidebar-border">
        <div className="relative h-7 w-7 rounded-full ring-glow flex items-center justify-center">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-sm font-semibold tracking-wide">JARVIS</span>
          <span className="text-[10px] font-mono text-muted-foreground">v0.1.0 · local</span>
        </div>
      </div>

      <nav className="flex-1 p-2 flex flex-col gap-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <Icon className={cn("h-4 w-4", active && "text-primary")} />
              <span>{label}</span>
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary animate-hud-pulse" />}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        <div className="rounded-md border border-sidebar-border bg-sidebar-accent/50 p-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Hotkey</p>
          <div className="mt-1 flex items-center gap-1 text-xs font-mono">
            <kbd className="rounded border border-border bg-background px-1.5 py-0.5">Ctrl</kbd>
            <span className="text-muted-foreground">+</span>
            <kbd className="rounded border border-border bg-background px-1.5 py-0.5">Space</kbd>
          </div>
        </div>
      </div>
    </aside>
  )
}
