"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { jarvis, isElectronEnv } from "@/lib/jarvis-bridge"
import type { SystemStatus } from "@/lib/types"

interface JarvisCtx {
  status: SystemStatus | null
  refresh: () => void
  isElectron: boolean
}

const Ctx = createContext<JarvisCtx>({ status: null, refresh: () => {}, isElectron: false })

export function JarvisProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [isElectron, setIsElectron] = useState(false)

  const refresh = useCallback(() => {
    jarvis()
      .status()
      .then(setStatus)
      .catch(() => {})
  }, [])

  useEffect(() => {
    setIsElectron(isElectronEnv())
    refresh()
    const t = setInterval(refresh, 5000)
    return () => clearInterval(t)
  }, [refresh])

  return <Ctx.Provider value={{ status, refresh, isElectron }}>{children}</Ctx.Provider>
}

export function useJarvis() {
  return useContext(Ctx)
}
