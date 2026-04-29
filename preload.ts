/**
 * Preload script — runs in an isolated context with access to Node + ipcRenderer.
 * Exposes a typed window.electronAPI to the Next.js renderer.
 */

import { contextBridge, ipcRenderer } from "electron"

const api = {
  isElectron: () => true,
  status: () => ipcRenderer.invoke("jarvis:status"),
  chat: (messages: any[]) => ipcRenderer.invoke("jarvis:chat", messages),
  chatStream: async (messages: any[], onToken: (t: string) => void) => {
    const text = await ipcRenderer.invoke("jarvis:chat", messages)
    onToken(text)
    return text
  },
  runShell: (cmd: string, opts?: { cwd?: string }) =>
    ipcRenderer.invoke("jarvis:runShell", cmd, opts),
  openApp: (name: string) => ipcRenderer.invoke("jarvis:openApp", name),
  openUrl: (url: string) => ipcRenderer.invoke("jarvis:openUrl", url),
  captureScreen: () => ipcRenderer.invoke("jarvis:captureScreen"),
  listActions: () => ipcRenderer.invoke("jarvis:listActions"),
  revertAction: (id: string) => ipcRenderer.invoke("jarvis:revertAction", id),
  listMemories: (q?: string) => ipcRenderer.invoke("jarvis:listMemories", q),
  writeMemory: (m: any) => ipcRenderer.invoke("jarvis:writeMemory", m),
  getSuggestions: () => ipcRenderer.invoke("jarvis:getSuggestions"),
  setHotkey: (accel: string) => ipcRenderer.invoke("jarvis:setHotkey", accel),

  // Coding / Antigravity
  codingTooling: () => ipcRenderer.invoke("jarvis:codingTooling"),
  listProjects: () => ipcRenderer.invoke("jarvis:listProjects"),
  createProject: (input: any) => ipcRenderer.invoke("jarvis:createProject", input),
  listProjectFiles: (id: string) => ipcRenderer.invoke("jarvis:listProjectFiles", id),
  readProjectFile: (id: string, rel: string) => ipcRenderer.invoke("jarvis:readProjectFile", id, rel),
  cancelCodeRun: (runId: string) => ipcRenderer.invoke("jarvis:cancelCodeRun", runId),
  openInAntigravity: (id: string) => ipcRenderer.invoke("jarvis:openInAntigravity", id),
  openProjectFolder: (id: string) => ipcRenderer.invoke("jarvis:openProjectFolder", id),
  generateCode: async (
    input: { projectId: string; prompt: string; model?: string },
    onEvent: (e: any) => void,
  ) => {
    const channel = `jarvis:codeRun:${Math.random().toString(36).slice(2, 10)}`
    const handler = (_: unknown, ev: any) => {
      onEvent(ev)
      if (ev?.type === "done" || ev?.type === "error") {
        ipcRenderer.removeListener(channel, handler)
      }
    }
    ipcRenderer.on(channel, handler)
    return ipcRenderer.invoke("jarvis:generateCode", { ...input, channel })
  },
}

contextBridge.exposeInMainWorld("electronAPI", api)
