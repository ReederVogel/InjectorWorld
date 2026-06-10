'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { DirectoryProvider } from '@/lib/location-queries'
import { ClusterLayer } from '@/components/ui/ClusterLayer'

function pinSvg(fill: string, stroke: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="42" viewBox="0 0 38 46">
    <defs><filter id="s"><feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#0B1B34" flood-opacity="0.35"/></filter></defs>
    <path d="M19 1 C 9 1 1 9 1 19 c 0 13 18 26 18 26 s 18 -13 18 -26 C 37 9 29 1 19 1 z"
      fill="${fill}" stroke="${stroke}" stroke-width="2.5" filter="url(#s)"/>
    <circle cx="19" cy="18" r="6" fill="white"/>
  </svg>`
}

const restingIcon = L.divIcon({
  className: 'injectors-pin',
  html: pinSvg('rgb(63,166,138)', 'white'),
  iconSize: [34, 42], iconAnchor: [17, 40], popupAnchor: [0, -38],
})

const activeIcon = L.divIcon({
  className: 'injectors-pin',
  html: pinSvg('rgb(11,27,52)', 'rgb(63,166,138)'),
  iconSize: [40, 50], iconAnchor: [20, 48], popupAnchor: [0, -46],
})

function esc(s?: string): string {
  if (!s) return ''
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  )
}

/** Popup markup for a clustered provider pin (imperative markers take a string). */
function providerPopupHtml(p: DirectoryProvider): string {
  const photo = p.profilePhotoUrl
    ? `<img src="${esc(p.profilePhotoUrl)}" alt="${esc(p.fullName)}" width="36" height="36" style="border-radius:9999px;object-fit:cover;flex-shrink:0" />`
    : ''
  const rating = p.aggregateRating
    ? `<div style="font-size:11px;color:#94A3B8;margin-top:2px">${p.aggregateRating.toFixed(1)} stars</div>`
    : ''
  return (
    `<div style="display:flex;align-items:flex-start;gap:8px;min-width:180px">${photo}` +
    `<div><div style="font-weight:600;font-size:13px;color:#0B1B34;line-height:1.2">${esc(p.fullName)}</div>` +
    `<div style="font-size:11px;color:#475569;margin-top:2px">${esc(p.clinic.neighborhood || p.clinic.city)}</div>` +
    `${rating}` +
    `<a href="/injectors/${esc(p.slug)}" style="display:block;margin-top:6px;font-size:11px;color:#3FA68A;font-weight:500;text-decoration:none">View profile</a>` +
    `</div></div>`
  )
}

function AutoFit({ providers }: { providers: DirectoryProvider[] }) {
  const map = useMap()
  useEffect(() => {
    const timeout = setTimeout(() => map.invalidateSize(), 60)
    return () => clearTimeout(timeout)
  }, [map])

  useEffect(() => {
    const pts = providers.filter((p) => p.clinic.latitude && p.clinic.longitude)
    if (pts.length === 0) return
    if (pts.length === 1) {
      map.setView([pts[0].clinic.latitude, pts[0].clinic.longitude], 13)
      return
    }
    const bounds = L.latLngBounds(pts.map((p) => [p.clinic.latitude, p.clinic.longitude]))
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 13 })
  }, [map, providers])

  return null
}

type Props = {
  providers: DirectoryProvider[]
  activeId?: string | null
  onPinClick?: (id: string) => void
  height?: string
  className?: string
}

export function DirectoryMap({ providers, activeId, onPinClick, height = '360px', className }: Props) {
  const withCoords = providers.filter((p) => p.clinic.latitude && p.clinic.longitude)
  const center: [number, number] =
    withCoords.length > 0
      ? [withCoords[0].clinic.latitude, withCoords[0].clinic.longitude]
      : [40.7128, -74.006]

  return (
    <div style={{ height }} className={className ?? 'rounded-xl overflow-hidden border border-border shadow-sm'}>
      <MapContainer
        center={center}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        className="injectors-map"
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          subdomains="abcd"
          maxZoom={19}
        />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />
        <AutoFit providers={withCoords} />

        <ClusterLayer
          pins={withCoords.map((p) => ({
            id: p.id,
            lat: p.clinic.latitude,
            lng: p.clinic.longitude,
            provider: p,
          }))}
          activeId={activeId}
          onPinClick={onPinClick}
          makeIcon={(_pin, active) => (active ? activeIcon : restingIcon)}
          buildPopup={(pin) => providerPopupHtml(pin.provider)}
        />
      </MapContainer>
    </div>
  )
}
