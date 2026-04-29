"use client"

import { useCallback, useEffect, useRef, useState } from "react"

type Mode = "idle" | "listening" | "thinking" | "speaking"

/**
 * Continuous voice mode — like ChatGPT's voice mode.
 *
 * Strategy:
 * - Use Web Speech API (SpeechRecognition) for real-time transcription
 *   while the user speaks. When the user stops, fire onUtterance with the
 *   final transcript.
 * - Use Web Audio API + AnalyserNode to compute audio level for the orb.
 * - Use SpeechSynthesis for TTS. After a response is "spoken", we
 *   automatically resume listening — that's what makes it continuous.
 *
 * This works in the browser AND inside Electron (Electron uses Chromium so
 * the Web Speech API is available there too). In Electron, the main process
 * can also do offline Whisper.cpp / piper TTS via the bridge later.
 */
export function useVoiceMode({
  onUtterance,
}: {
  onUtterance: (text: string) => Promise<string>
}) {
  const [mode, setMode] = useState<Mode>("idle")
  const [level, setLevel] = useState(0)
  const [transcript, setTranscript] = useState("")
  const [error, setError] = useState<string | null>(null)

  const recognitionRef = useRef<any>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const activeRef = useRef(false)

  const tick = useCallback(() => {
    const a = analyserRef.current
    if (!a) return
    const data = new Uint8Array(a.frequencyBinCount)
    a.getByteTimeDomainData(data)
    let sum = 0
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128
      sum += v * v
    }
    const rms = Math.sqrt(sum / data.length)
    setLevel(Math.min(1, rms * 4))
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const speak = useCallback((text: string) => {
    return new Promise<void>((resolve) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        resolve()
        return
      }
      const u = new SpeechSynthesisUtterance(text)
      u.rate = 1.05
      u.pitch = 1.0
      u.onend = () => resolve()
      u.onerror = () => resolve()
      window.speechSynthesis.speak(u)
    })
  }, [])

  const startListening = useCallback(async () => {
    if (typeof window === "undefined") return
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      setError("SpeechRecognition not available in this browser. In the desktop build we use Whisper.cpp locally.")
      return
    }

    if (!streamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        streamRef.current = stream
        const ctx = new AudioContext()
        audioCtxRef.current = ctx
        const src = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 1024
        src.connect(analyser)
        analyserRef.current = analyser
        rafRef.current = requestAnimationFrame(tick)
      } catch (e: any) {
        setError("Microphone permission denied")
        return
      }
    }

    const rec = new SR()
    rec.continuous = false
    rec.interimResults = true
    rec.lang = "en-US"

    let finalText = ""
    rec.onresult = (e: any) => {
      let interim = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) finalText += t
        else interim += t
      }
      setTranscript(finalText + interim)
    }
    rec.onend = async () => {
      if (!activeRef.current) return
      const text = finalText.trim()
      if (text) {
        setMode("thinking")
        try {
          const reply = await onUtterance(text)
          if (reply) {
            setMode("speaking")
            await speak(reply)
          }
        } catch (err) {
          console.log("[v0] voice onUtterance error", err)
        }
        finalText = ""
        setTranscript("")
      }
      // Loop — resume listening for continuous mode
      if (activeRef.current) {
        setMode("listening")
        try {
          rec.start()
        } catch {}
      }
    }
    rec.onerror = (e: any) => {
      console.log("[v0] rec error", e?.error)
      if (activeRef.current && e?.error !== "aborted") {
        setTimeout(() => {
          try {
            rec.start()
          } catch {}
        }, 600)
      }
    }
    recognitionRef.current = rec
    rec.start()
    setMode("listening")
  }, [onUtterance, speak, tick])

  const start = useCallback(async () => {
    activeRef.current = true
    setError(null)
    await startListening()
  }, [startListening])

  const stop = useCallback(() => {
    activeRef.current = false
    setMode("idle")
    setTranscript("")
    try {
      recognitionRef.current?.stop()
    } catch {}
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (audioCtxRef.current?.state !== "closed") {
      audioCtxRef.current?.close().catch(() => {})
    }
    audioCtxRef.current = null
    analyserRef.current = null
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel()
    }
    setLevel(0)
  }, [])

  useEffect(() => () => stop(), [stop])

  return { mode, level, transcript, error, start, stop, isActive: activeRef.current }
}
