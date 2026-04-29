"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

type Mode = "idle" | "listening" | "thinking" | "speaking"

interface Props {
  mode: Mode
  /** Audio level 0–1 used to scale the inner core when listening/speaking */
  level?: number
  size?: number
}

/**
 * The Jarvis HUD voice visualizer — concentric rings, slow rotation,
 * inner audio-reactive core. Inspired by Image 1.
 */
export function VoiceOrb({ mode, level = 0, size = 360 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [tick, setTick] = useState(0)

  // Render an audio-reactive bar ring on canvas
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext("2d")
    if (!ctx) return
    let raf = 0
    let t = 0
    const dpr = window.devicePixelRatio || 1
    c.width = size * dpr
    c.height = size * dpr
    ctx.scale(dpr, dpr)

    const draw = () => {
      t += 0.025
      ctx.clearRect(0, 0, size, size)
      const cx = size / 2
      const cy = size / 2
      const baseR = size * 0.36
      const bars = 96

      ctx.save()
      ctx.translate(cx, cy)
      for (let i = 0; i < bars; i++) {
        const a = (i / bars) * Math.PI * 2
        const noise =
          Math.sin(t * 1.6 + i * 0.34) * 0.5 +
          Math.sin(t * 2.7 + i * 0.21) * 0.5
        const reactive = mode === "listening" || mode === "speaking" ? level : 0
        const len = 6 + (noise + 1) * 4 + reactive * 28
        const inner = baseR
        const outer = baseR + len
        const x1 = Math.cos(a) * inner
        const y1 = Math.sin(a) * inner
        const x2 = Math.cos(a) * outer
        const y2 = Math.sin(a) * outer
        ctx.strokeStyle =
          mode === "thinking"
            ? `oklch(0.78 0.14 210 / ${0.15 + (noise + 1) * 0.18})`
            : `oklch(0.85 0.13 200 / ${0.25 + (noise + 1) * 0.25})`
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
      }
      ctx.restore()
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [size, mode, level])

  // Re-render reticle text every ~250ms
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 250)
    return () => clearInterval(t)
  }, [])

  const reticle = (() => {
    const labels = ["NEURAL CORE", "JARVIS-01", "ONLINE", "STAND BY", "LISTEN", "RESPOND"]
    return labels[tick % labels.length]
  })()

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-label={`Jarvis ${mode}`}
      role="img"
    >
      {/* Outermost rotating ring with tick marks */}
      <div
        className="absolute inset-0 animate-hud-rotate"
        style={{
          backgroundImage:
            "repeating-conic-gradient(from 0deg, oklch(0.78 0.14 210 / 0.45) 0deg 1deg, transparent 1deg 6deg)",
          WebkitMask:
            "radial-gradient(circle, transparent calc(50% - 2px), black calc(50% - 1px), black calc(50% + 1px), transparent calc(50% + 2px))",
          mask:
            "radial-gradient(circle, transparent calc(50% - 2px), black calc(50% - 1px), black calc(50% + 1px), transparent calc(50% + 2px))",
        }}
      />

      {/* Outer ring */}
      <div className="absolute inset-2 rounded-full border border-primary/40 ring-glow" />

      {/* Mid rotating ring (reverse) with arc gaps */}
      <div className="absolute inset-8 animate-hud-rotate-reverse">
        <div
          className="h-full w-full rounded-full border-2 border-primary/30"
          style={{
            borderStyle: "dashed",
            borderImage:
              "conic-gradient(from 0deg, oklch(0.78 0.14 210 / 0.7) 0deg 60deg, transparent 60deg 120deg, oklch(0.78 0.14 210 / 0.7) 120deg 180deg, transparent 180deg 240deg, oklch(0.78 0.14 210 / 0.7) 240deg 300deg, transparent 300deg 360deg) 1",
          }}
        />
      </div>

      {/* Mid ring */}
      <div className="absolute inset-14 rounded-full border border-primary/25" />

      {/* Audio-reactive bar canvas */}
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="absolute inset-0"
      />

      {/* Inner pulsing core */}
      <div
        className={cn(
          "absolute rounded-full bg-primary/15 ring-glow flex items-center justify-center",
          mode === "thinking" && "animate-hud-breathe",
          mode !== "idle" && "animate-hud-pulse",
        )}
        style={{
          width: size * 0.42,
          height: size * 0.42,
        }}
      >
        <div
          className="rounded-full bg-primary/25"
          style={{
            width: size * 0.22 + level * size * 0.08,
            height: size * 0.22 + level * size * 0.08,
            boxShadow:
              "0 0 40px oklch(0.78 0.14 210 / 0.7), inset 0 0 20px oklch(0.85 0.13 200 / 0.5)",
            transition: "width 80ms linear, height 80ms linear",
          }}
        />
      </div>

      {/* Cardinal tick labels */}
      <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] font-mono tracking-[0.3em] text-primary/70">
        {reticle}
      </span>
      <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-mono tracking-[0.3em] text-primary/50">
        {mode.toUpperCase()}
      </span>
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-mono text-primary/50">
        N
      </span>
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-mono text-primary/50">
        S
      </span>
    </div>
  )
}
