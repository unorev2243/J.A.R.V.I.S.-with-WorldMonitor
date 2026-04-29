// US National Weather Service active alerts. Public, no key.
// https://api.weather.gov/alerts/active

import { NextResponse } from "next/server"

export const revalidate = 120

type Alert = {
  id: string
  event: string
  severity: string
  urgency: string
  area: string
  headline: string
  sent: number
  lat: number | null
  lon: number | null
}

export async function GET() {
  try {
    const res = await fetch("https://api.weather.gov/alerts/active", {
      next: { revalidate: 120 },
      headers: {
        "user-agent": "jarvis-monitor/1.0 (contact: local)",
        accept: "application/geo+json",
      },
    })
    if (!res.ok) throw new Error(`NWS ${res.status}`)
    const data = await res.json()

    const alerts: Alert[] = (data.features ?? [])
      .map((f: any) => {
        let lat: number | null = null
        let lon: number | null = null
        const g = f.geometry
        if (g?.type === "Polygon") {
          const ring: number[][] = g.coordinates[0]
          lon = ring.reduce((s, p) => s + p[0], 0) / ring.length
          lat = ring.reduce((s, p) => s + p[1], 0) / ring.length
        }
        return {
          id: f.id,
          event: f.properties.event,
          severity: f.properties.severity,
          urgency: f.properties.urgency,
          area: f.properties.areaDesc,
          headline: f.properties.headline,
          sent: new Date(f.properties.sent).getTime(),
          lat,
          lon,
        }
      })
      .filter((a: Alert) => a.severity === "Severe" || a.severity === "Extreme")

    return NextResponse.json({ ok: true, count: alerts.length, alerts })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message, alerts: [] },
      { status: 200 },
    )
  }
}
