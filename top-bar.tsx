"use client"

import { useJarvis } from "./jarvis-provider"
import { Cpu, HardDrive, Wifi, WifiOff } from "lucide-react"

export function TopBar() {
  const { status, isElectron } = useJarvis()
  return (
    <header className="h-14 border-b border-border flex items-center px-4 gap-4 bg-background/60 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-hud-pulse" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          {isElectron ? "Connected · Desktop" : "Web Preview · Mock"}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-4 text-xs font-mono text-muted-foreground">
        <Stat icon={Cpu} label="CPU" value={status ? `${status.cpu.toFixed(0)}%` : "—"} />
        <Stat icon={HardDrive} label="RAM" value={status ? `${status.ram.toFixed(0)}%` : "—"} />
        <div className="flex items-center gap-1.5">
          {status?.ollamaOnline ? (
            <Wifi className="h-3.5 w-3.5 text-primary" />
          ) : (
            <WifiOff className="h-3.5 w-3.5 text-destructive" />
          )}
          <span>{status?.ollamaModel ?? "ollama offline"}</span>
        </div>
      </div>
    </header>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5" />
      <span className="text-foreground/60">{label}</span>
      <span className="text-foreground tabular-nums">{value}</span>
    </div>
  )
}
