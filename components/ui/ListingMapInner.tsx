'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'

export type MapPin = {
  id: string
  lat: number
  lng: number
  title: string
  subtitle?: string
  meta?: string
  href: string
  rating?: number
  price?: number
}

function pinSvg(fill: string, stroke: string, size: number) {
  const r = size * 0.5
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${Math.round(size * 1.21)}" viewBox="0 0 38 46">
    <defs><filter id="ps" x="-50%" y="-30%" width="200%" height="200%">
      <feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#0B1B34" flood-opacity="0.35"/>
    </filter></defs>
    <path d="M19 1 C 9 1 1 9 1 19 c 0 13 18 26 18 26 s 18 -13 18 -26 C 37 9 29 1 19 1 z"
      fill="${fill}" stroke="${stroke}" stroke-width="2.5" filter="url(#ps)"/>
    <circle cx="19" cy="18" r="6" fill="white"/>
  </svg>`
}

function makeIcon(active: boolean) {
  return L.divIcon({
    className: 'injectors-pin',
    html: active
      ? pinSvg('#0B1B34', '#3FA68A', 46)
      : pinSvg('#3FA68A', 'white', 38),
    iconSize: active ? [46, 56] : [38, 46],
    iconAnchor: active ? [23, 54] : [19, 44],
    popupAnchor: [0, active ? -48 : -40],
  })
}

function AutoFit({ pins }: { pins: MapPin[] }) {
  const map = useMap()
  const fitted = useRef(false)

  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 60)
  }, [map])

  useEffect(() => {
    if (fitted.current || pins.length === 0) return
    if (pins.length === 1) {
      map.setView([pins[0].lat, pins[0].lng], 13)
    } else {
      const bounds = pins.map((p) => [p.lat, p.lng] as [number, number])
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 13 })
    }
    fitted.current = true
  }, [map, pins])

  return null
}

export function ListingMapInner({
  pins,
  activePinId,
  onPinClick,
  height = 520,
}: {
  pins: MapPin[]
  activePinId?: string | null
  onPinClick?: (id: string) => void
  height?: number
}) {
  const valid = useMemo(() => pins.filter((p) => p.lat !== 0 && p.lng !== 0), [pins])
  const center = useMemo<[number, number]>(() => {
    if (valid.length === 0) return [40.7128, -74.006]
    const lat = valid.reduce((s, p) => s + p.lat, 0) / valid.length
    const lng = valid.reduce((s, p) => s + p.lng, 0) / valid.length
    return [lat, lng]
  }, [valid])

  if (valid.length === 0) {
    return (
      <div
        className="w-full rounded-2xl bg-surface border border-border flex items-center justify-center text-ink-tertiary text-body-sm"
        style={{ height }}
      >
        No location data available
      </div>
    )
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-border shadow-md" style={{ height }}>
      <MapContainer
        center={center}
        zoom={11}
        scrollWheelZoom={false}
        zoomControl
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
        className="injectors-map"
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png"
          subdomains={['a', 'b', 'c', 'd']}
          maxZoom={19}
        />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
          subdomains={['a', 'b', 'c', 'd']}
          maxZoom={19}
          opacity={0.85}
        />
        <AutoFit pins={valid} />
        {valid.map((p) => (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={makeIcon(activePinId === p.id)}
            eventHandlers={{ click: () => onPinClick?.(p.id) }}
          >
            <Popup>
              <a href={p.href} className="block min-w-[180px] no-underline">
                <div className="font-semibold text-[13px] text-ink-primary mb-0.5 leading-snug">{p.title}</div>
                {p.subtitle && <div className="text-[11px] text-ink-secondary">{p.subtitle}</div>}
                {p.meta && <div className="text-[11px] text-ink-tertiary mt-0.5">{p.meta}</div>}
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border-subtle">
                  {p.rating && (
                    <span className="text-[11px] font-semibold text-ink-primary">
                      ★ {p.rating.toFixed(1)}
                    </span>
                  )}
                  {p.price && (
                    <span className="text-[11px] text-ink-secondary">from ${p.price}</span>
                  )}
                  <span className="text-[11px] text-brand-accent ml-auto">View →</span>
                </div>
              </a>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
