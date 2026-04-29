"use client"

import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps"

interface MarkerData {
  name: string
  coordinates: [number, number]
  severity: "low" | "med" | "high"
  detail: string
}

interface Props {
  markers: MarkerData[]
  active: string | null
  onSelect: (name: string) => void
}

// Free public TopoJSON of countries — used by react-simple-maps docs.
const GEO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json"

export function WorldMap({ markers, active, onSelect }: Props) {
  return (
    <div className="relative h-full w-full">
      <ComposableMap
        projection="geoEqualEarth"
        projectionConfig={{ scale: 165 }}
        style={{ width: "100%", height: "100%", background: "transparent" }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                style={{
                  default: {
                    fill: "oklch(0.18 0.02 240)",
                    stroke: "oklch(0.32 0.04 220)",
                    strokeWidth: 0.5,
                    outline: "none",
                  },
                  hover: {
                    fill: "oklch(0.22 0.03 230)",
                    stroke: "oklch(0.78 0.14 210 / 0.6)",
                    strokeWidth: 0.7,
                    outline: "none",
                  },
                  pressed: { fill: "oklch(0.24 0.04 220)", outline: "none" },
                }}
              />
            ))
          }
        </Geographies>

        {markers.map((m) => {
          const color =
            m.severity === "high"
              ? "oklch(0.65 0.22 25)"
              : m.severity === "med"
              ? "oklch(0.85 0.18 90)"
              : "oklch(0.78 0.14 210)"
          const isActive = active === m.name
          return (
            <Marker
              key={m.name}
              coordinates={m.coordinates}
              onClick={() => onSelect(m.name)}
              style={{ default: { cursor: "pointer" }, hover: { cursor: "pointer" }, pressed: {} }}
            >
              {/* outer pulse */}
              <circle r={isActive ? 11 : 8} fill={color} fillOpacity={0.15}>
                <animate attributeName="r" values={`${isActive ? 11 : 8};${isActive ? 17 : 13};${isActive ? 11 : 8}`} dur="2.4s" repeatCount="indefinite" />
                <animate attributeName="fill-opacity" values="0.05;0.25;0.05" dur="2.4s" repeatCount="indefinite" />
              </circle>
              {/* mid ring */}
              <circle
                r={isActive ? 5.5 : 4}
                fill="none"
                stroke={color}
                strokeWidth={isActive ? 1.3 : 0.9}
                strokeOpacity={0.85}
              />
              {/* inner dot */}
              <circle r={isActive ? 2.4 : 1.8} fill={color} />
              {isActive && (
                <text
                  textAnchor="middle"
                  y={-14}
                  style={{
                    fontFamily: "var(--font-geist-mono)",
                    fontSize: 9,
                    fill: "oklch(0.78 0.14 210)",
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    pointerEvents: "none",
                  }}
                >
                  {m.name}
                </text>
              )}
            </Marker>
          )
        })}
      </ComposableMap>
    </div>
  )
}
