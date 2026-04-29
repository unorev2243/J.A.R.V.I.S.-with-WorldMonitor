/**
 * Safe shell execution.
 *
 * Guardrails:
 *  - Block clearly dangerous patterns by default (rm -rf /, format, etc.)
 *  - Block any command touching financial / banking domains
 *  - All shell runs are recorded in the action log
 *
 * For full power, the renderer should always confirm before sending a shell
 * command — see the system prompt in lib/ollama.ts.
 */

import { exec } from "node:child_process"
import { promisify } from "node:util"
import { actionLog } from "./action-log"

const execAsync = promisify(exec)

const DANGEROUS = [
  /\brm\s+-rf\s+\/(?!\w)/i,
  /\bformat\s+[a-z]:/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /shutdown\s+\/[rs]/i,
  /:\(\)\s*\{\s*:\|:&\s*\};:/, // fork bomb
  /Remove-Item\s+-Recurse\s+-Force\s+\\/i,
]

const FINANCIAL_HINTS = [
  /\bzelle\b/i,
  /\bvenmo\b/i,
  /\bplaid\b/i,
  /\bach\s*transfer/i,
  /\bwire\s*transfer/i,
]

export async function runShell(
  cmd: string,
  opts: { cwd?: string } = {},
): Promise<{ stdout: string; stderr: string; code: number }> {
  if (DANGEROUS.some((re) => re.test(cmd))) {
    const err = `[jarvis] refused: command matches dangerous pattern. Override in Settings.`
    await actionLog.record({
      kind: "shell",
      summary: `Refused: ${cmd.slice(0, 80)}`,
      payload: { cmd },
      revertData: null,
      status: "failed",
      error: err,
    })
    return { stdout: "", stderr: err, code: 99 }
  }
  if (FINANCIAL_HINTS.some((re) => re.test(cmd))) {
    const err = `[jarvis] refused: financial systems are off-limits. This is a permanent guardrail.`
    await actionLog.record({
      kind: "shell",
      summary: `Refused (financial): ${cmd.slice(0, 80)}`,
      payload: { cmd },
      revertData: null,
      status: "failed",
      error: err,
    })
    return { stdout: "", stderr: err, code: 99 }
  }

  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: opts.cwd,
      // Windows uses cmd.exe by default; if user has PowerShell preference,
      // they can prefix `powershell -Command "..."` themselves.
      maxBuffer: 1024 * 1024 * 8,
      shell: process.platform === "win32" ? "cmd.exe" : "/bin/bash",
    })
    await actionLog.record({
      kind: "shell",
      summary: `Ran: ${cmd.slice(0, 80)}`,
      payload: { cmd, cwd: opts.cwd ?? null },
      revertData: null,
      status: "success",
      completedAt: Date.now(),
    })
    return { stdout, stderr, code: 0 }
  } catch (err: any) {
    await actionLog.record({
      kind: "shell",
      summary: `Failed: ${cmd.slice(0, 80)}`,
      payload: { cmd },
      revertData: null,
      status: "failed",
      error: err?.message,
    })
    return { stdout: err?.stdout ?? "", stderr: err?.stderr ?? err.message, code: err?.code ?? 1 }
  }
}
