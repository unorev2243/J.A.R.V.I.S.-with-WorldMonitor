import { desktopCapturer, screen } from "electron"

/**
 * Capture the primary screen as a data URL.
 *
 * For continuous screen monitoring, you'd run this on a timer in the proactive
 * daemon and pipe the image into a multimodal LLM (e.g. llava / qwen2-vl
 * locally via Ollama) to extract a one-line note about what's on screen.
 */
export async function captureScreen(): Promise<{ dataUrl: string }> {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: { width, height },
  })
  const primary = sources[0]
  if (!primary) throw new Error("No screen source available")
  return { dataUrl: primary.thumbnail.toDataURL() }
}
