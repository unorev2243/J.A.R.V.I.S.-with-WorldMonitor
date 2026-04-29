import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { Sidebar } from "@/components/sidebar"
import { TopBar } from "@/components/top-bar"
import { JarvisProvider } from "@/components/jarvis-provider"
import { Toaster } from "@/components/ui/sonner"

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })

export const metadata: Metadata = {
  title: "Jarvis — Personal AI",
  description: "Integrated AI assistant with full PC access, voice mode, persistent memory, and proactive suggestions.",
  generator: "v0.app",
}

export const viewport: Viewport = {
  themeColor: "#0a0e14",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`dark ${geist.variable} ${geistMono.variable} bg-background`}>
      <body className="font-sans antialiased min-h-screen bg-background text-foreground overflow-hidden">
        <JarvisProvider>
          <div className="flex h-screen w-screen">
            <Sidebar />
            <div className="flex flex-1 flex-col min-w-0">
              <TopBar />
              <main className="flex-1 overflow-auto">{children}</main>
            </div>
          </div>
          <Toaster theme="dark" position="bottom-right" />
        </JarvisProvider>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
