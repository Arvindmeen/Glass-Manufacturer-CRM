import { useEffect, useRef, useState } from 'react'
import type { Point } from '../lib/route'

export interface MapPin {
  id: string
  label: string
  point: Point
  selected: boolean
  order?: number
}

/** Lightweight offline map: projects coordinates into an SVG, draws the route in stop order. */
export function CompanyMap({ pins, onToggle, start }: { pins: MapPin[]; onToggle: (id: string) => void; start?: Point }) {
  // Draw at the real pixel width so labels and pins keep a readable size on phones.
  const box = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(600)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const all = [...pins.map((p) => p.point), ...(start ? [start] : [])]
  if (all.length === 0) return <div ref={box} />
  const lats = all.map((p) => p.lat)
  const lngs = all.map((p) => p.lng)
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2
  const kx = Math.cos((midLat * Math.PI) / 180)
  const minX = Math.min(...lngs) * kx
  const maxX = Math.max(...lngs) * kx
  const minY = -Math.max(...lats)
  const maxY = -Math.min(...lats)
  const pad = 28
  const maxH = Math.min(W * 1.1, window.innerWidth < 900 ? window.innerHeight * 0.42 : window.innerHeight - 160)
  const scale = Math.min((W - pad * 2) / Math.max(maxX - minX, 1e-3), (maxH - pad * 2) / Math.max(maxY - minY, 1e-3))
  const H = Math.round((maxY - minY) * scale + pad * 2)
  const ox = (W - (maxX - minX) * scale) / 2
  const oy = (H - (maxY - minY) * scale) / 2
  const xy = (p: Point) => [ox + (p.lng * kx - minX) * scale, oy + (-p.lat - minY) * scale] as const

  const route = pins.filter((p) => p.order != null).sort((a, b) => a.order! - b.order!)
  const line = [...(start && route.length ? [start] : []), ...route.map((r) => r.point)].map((p) => xy(p).join(',')).join(' ')

  return (
    <div ref={box}>
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="map" role="img">
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--border)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#grid)" />
      {route.length > 1 && (
        <polyline points={line} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinejoin="round" strokeDasharray="1 7" strokeLinecap="round" />
      )}
      {start && (
        <g transform={`translate(${xy(start).join(',')})`}>
          <circle r="12" fill="#3b82f6" opacity="0.2" />
          <circle r="6" fill="#3b82f6" stroke="#fff" strokeWidth="3" />
        </g>
      )}
      {pins.map((p) => {
        const [x, y] = xy(p.point)
        return (
          <g key={p.id} transform={`translate(${x},${y})`} onClick={() => onToggle(p.id)} style={{ cursor: 'pointer' }}>
            <circle r="22" fill="transparent" />
            <circle r={p.selected ? 11 : 7} fill={p.selected ? 'var(--accent)' : 'var(--primary)'} stroke="#fff" strokeWidth="2" />
            {p.order != null && (
              <text textAnchor="middle" dy="4" fontSize="11" fontWeight="700" fill="#fff">
                {p.order + 1}
              </text>
            )}
            {p.selected && (
              <text x={x > W * 0.6 ? -15 : 15} textAnchor={x > W * 0.6 ? 'end' : 'start'} dy="4" fontSize="12" fontWeight="600" fill="var(--text)" stroke="var(--surface)" strokeWidth="4" paintOrder="stroke">
                {p.label}
              </text>
            )}
          </g>
        )
      })}
    </svg>
    </div>
  )
}
