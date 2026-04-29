/**
 * Compiles the Electron main + preload TypeScript into dist-electron/.
 * Run via: pnpm electron:compile
 *
 * Uses esbuild (bundled with Next/Vercel toolchain) to keep things fast and
 * avoid a separate tsc step. better-sqlite3 stays external because it's a
 * native module that Electron loads from node_modules at runtime.
 */
import { build } from "esbuild"
import { existsSync, mkdirSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(__dirname, "..")
const outdir = resolve(root, "dist-electron")
if (!existsSync(outdir)) mkdirSync(outdir, { recursive: true })

const shared = {
  platform: "node" as const,
  target: "node20",
  format: "cjs" as const,
  bundle: true,
  sourcemap: true,
  external: [
    "electron",
    "better-sqlite3",
    // Electron-only / native modules must not be bundled.
  ],
}

async function main() {
  await build({
    ...shared,
    entryPoints: [resolve(root, "electron/main.ts")],
    outfile: resolve(outdir, "main.js"),
  })
  await build({
    ...shared,
    entryPoints: [resolve(root, "electron/preload.ts")],
    outfile: resolve(outdir, "preload.js"),
  })
  console.log("[jarvis] electron compiled to", outdir)
}

main().catch((err) => {
  console.error("[jarvis] electron build failed:", err)
  process.exit(1)
})
