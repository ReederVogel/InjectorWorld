'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import Image from 'next/image'
import Link from 'next/link'
import type { DirectoryProvider } from '@/lib/location-queries'

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
}

export function DirectoryMap({ providers, activeId, onPinClick, height = '360px' }: Props) {
  const withCoords = providers.filter((p) => p.clinic.latitude && p.clinic.longitude)
  const center: [number, number] =
    withCoords.length > 0
      ? [withCoords[0].clinic.latitude, withCoords[0].clinic.longitude]
      : [40.7128, -74.006]

  return (
    <div style={{ height }} className="rounded-xl overflow-hidden border border-border shadow-sm">
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

        {withCoords.map((p) => (
          <Marker
            key={p.id}
            position={[p.clinic.latitude, p.clinic.longitude]}
            icon={activeId === p.id ? activeIcon : restingIcon}
            eventHandlers={{ click: () => onPinClick?.(p.id) }}
          >
            <Popup>
              <div className="flex items-start gap-2 min-w-[180px]">
                {p.profilePhotoUrl && (
                  <Image src={p.profilePhotoUrl} alt={p.fullName} width={36} height={36} className="rounded-full object-cover flex-shrink-0" />
                )}
                <div>
                  <div className="font-semibold text-[13px] text-ink-primary leading-tight">{p.fullName}</div>
                  <div className="text-[11px] text-ink-secondary mt-0.5">{p.clinic.neighborhood || p.clinic.city}</div>
                  {p.aggregateRating && (
                    <div className="text-[11px] text-ink-tertiary mt-0.5">{p.aggregateRating.toFixed(1)} stars</div>
                  )}
                  <Link href={`/injectors/${p.slug}`} className="block mt-1.5 text-[11px] text-brand-accent font-medium hover:underline">
                    View profile
                  </Link>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
