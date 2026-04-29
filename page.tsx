"use client"

import { useState } from "react"
import { Keyboard, Brain, Eye, ShieldAlert, Save, Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { jarvis } from "@/lib/jarvis-bridge"
import { toast } from "sonner"

export default function SettingsPage() {
  const [hotkey, setHotkey] = useState("CommandOrControl+Space")
  const [model, setModel] = useState("llama3.2")
  const [ollamaUrl, setOllamaUrl] = useState("http://127.0.0.1:11434")
  const [voice, setVoice] = useState(true)
  const [screenMonitor, setScreenMonitor] = useState(false)
  const [proactive, setProactive] = useState(true)
  const [confirmDestructive, setConfirmDestructive] = useState(true)
  const [confirmInstall, setConfirmInstall] = useState(true)
  const [neverFinancial, setNeverFinancial] = useState(true)

  const save = async () => {
    try {
      await jarvis().setHotkey(hotkey)
      toast.success("Settings saved")
    } catch (e: any) {
      toast.error("Failed to save", { description: e?.message })
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="px-6 py-4 border-b border-border">
        <h1 className="text-lg font-semibold">Settings</h1>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-3xl px-6 py-6 space-y-6">
          <Section icon={Keyboard} title="Hotkey">
            <div className="space-y-2">
              <Label htmlFor="hotkey">Global summon hotkey</Label>
              <Input
                id="hotkey"
                value={hotkey}
                onChange={(e) => setHotkey(e.target.value)}
                placeholder="CommandOrControl+Space"
                className="font-mono bg-card"
              />
              <p className="text-xs text-muted-foreground">
                Electron accelerator format. Default is{" "}
                <kbd className="rounded border border-border px-1 font-mono text-[10px]">Ctrl+Space</kbd> on
                Windows.
              </p>
            </div>
          </Section>

          <Section icon={Brain} title="Brain · Local AI">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="model">Ollama model</Label>
                <Input
                  id="model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="font-mono bg-card"
                />
                <p className="text-xs text-muted-foreground">
                  Suggested: <code className="text-primary">llama3.2</code>,{" "}
                  <code className="text-primary">qwen2.5:7b</code>, or{" "}
                  <code className="text-primary">mistral</code>.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="url">Ollama URL</Label>
                <Input
                  id="url"
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  className="font-mono bg-card"
                />
              </div>
            </div>
          </Section>

          <Section icon={Volume2} title="Voice">
            <Toggle
              label="Continuous voice mode"
              description="Like ChatGPT voice mode — Jarvis listens, responds, then resumes listening automatically."
              checked={voice}
              onChange={setVoice}
            />
          </Section>

          <Section icon={Eye} title="Screen monitoring">
            <Toggle
              label="Watch my screen and take notes"
              description="Periodic screenshots are analyzed locally; Jarvis writes notes about interesting findings to memory. Nothing leaves your machine."
              checked={screenMonitor}
              onChange={setScreenMonitor}
            />
            <Toggle
              label="Proactive suggestions"
              description="Background daemon surfaces calendar conflicts, follow-ups, and useful nudges."
              checked={proactive}
              onChange={setProactive}
            />
          </Section>

          <Section icon={ShieldAlert} title="Safety guardrails" tone="warn">
            <Toggle
              label="Confirm destructive actions"
              description="Always ask before deleting files, killing processes, or making changes that can't be reverted."
              checked={confirmDestructive}
              onChange={setConfirmDestructive}
            />
            <Toggle
              label="Confirm software installs"
              description="Always show the source URL and signature before installing anything from the internet."
              checked={confirmInstall}
              onChange={setConfirmInstall}
            />
            <Toggle
              label="Never touch financial systems"
              description="Hard-lock: Jarvis can read banking balances but cannot move money, ever. This cannot be disabled at runtime."
              checked={neverFinancial}
              onChange={() => toast.error("This guardrail is permanent.")}
              locked
            />
          </Section>

          <div className="flex justify-end">
            <Button onClick={save} size="lg">
              <Save className="mr-2 h-4 w-4" /> Save settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({
  icon: Icon,
  title,
  children,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  children: React.ReactNode
  tone?: "warn"
}) {
  return (
    <section
      className={`rounded-lg border bg-card/40 ${
        tone === "warn" ? "border-accent/30" : "border-border"
      }`}
    >
      <header className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Icon className={`h-4 w-4 ${tone === "warn" ? "text-accent" : "text-primary"}`} />
        <h2 className="text-sm font-semibold">{title}</h2>
      </header>
      <div className="p-4 space-y-4">{children}</div>
    </section>
  )
}

function Toggle({
  label,
  description,
  checked,
  onChange,
  locked,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (b: boolean) => void
  locked?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5 min-w-0">
        <Label className="text-sm">{label}</Label>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={locked} />
    </div>
  )
}
