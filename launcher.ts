import { shell } from "electron"
import { exec } from "node:child_process"
import { actionLog } from "./action-log"

const KNOWN_APPS_WIN: Record<string, string> = {
  code: "code",
  vscode: "code",
  notepad: "notepad.exe",
  explorer: "explorer.exe",
  cmd: "cmd.exe",
  powershell: "powershell.exe",
  chrome: 'start chrome',
  firefox: 'start firefox',
  edge: 'start msedge',
  spotify: 'start spotify:',
}

export async function openApp(name: string) {
  const key = name.trim().toLowerCase()
  const cmd =
    process.platform === "win32"
      ? KNOWN_APPS_WIN[key] ?? `start "" "${name}"`
      : process.platform === "darwin"
      ? `open -a "${name}"`
      : `xdg-open "${name}"`
  await new Promise<void>((res, rej) => {
    exec(cmd, (err) => (err ? rej(err) : res()))
  })
  await actionLog.record({
    kind: "app.open",
    summary: `Opened ${name}`,
    payload: { name, cmd },
    revertData: null,
  })
}

export async function openUrl(url: string) {
  await shell.openExternal(url)
  await actionLog.record({
    kind: "browser.open",
    summary: `Opened ${url}`,
    payload: { url },
    revertData: null,
  })
}
