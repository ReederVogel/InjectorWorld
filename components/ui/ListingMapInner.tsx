'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { ClusterLayer } from './ClusterLayer'

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

function esc(s?: string): string {
  if (!s) return ''
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  )
}

/** Popup markup for a clustered pin (imperative markers take an HTML string). */
function popupHtml(p: MapPin): string {
  const rating = p.rating
    ? `<span style="font-size:11px;font-weight:600;color:#0B1B34">&#9733; ${p.rating.toFixed(1)}</span>`
    : ''
  const price = p.price ? `<span style="font-size:11px;color:#475569">from $${p.price}</span>` : ''
  return (
    `<a href="${esc(p.href)}" style="display:block;min-width:180px;text-decoration:none">` +
    `<div style="font-weight:600;font-size:13px;color:#0B1B34;margin-bottom:2px;line-height:1.3">${esc(p.title)}</div>` +
    (p.subtitle ? `<div style="font-size:11px;color:#475569">${esc(p.subtitle)}</div>` : '') +
    (p.meta ? `<div style="font-size:11px;color:#94A3B8;margin-top:2px">${esc(p.meta)}</div>` : '') +
    `<div style="display:flex;align-items:center;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid #EEF1F5">` +
    `${rating}${price}<span style="font-size:11px;color:#3FA68A;margin-left:auto">View &rarr;</span></div>` +
    `</a>`
  )
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
        <ClusterLayer
          pins={valid}
          activeId={activePinId}
          onPinClick={onPinClick}
          makeIcon={(_p, active) => makeIcon(active)}
          buildPopup={(p) => popupHtml(p)}
        />
      </MapContainer>
    </div>
  )
}
