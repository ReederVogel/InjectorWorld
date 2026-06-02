'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L, { LatLngBoundsExpression } from 'leaflet'
import type { HeroProviderCard } from '@/lib/hero-queries'

function pinSvg(color: string, ring: string) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="38" height="46" viewBox="0 0 38 46">
      <defs>
        <filter id="s" x="-50%" y="-30%" width="200%" height="200%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#0B1B34" flood-opacity="0.4"/>
        </filter>
      </defs>
      <path
        d="M19 1 C 9 1 1 9 1 19 c 0 13 18 26 18 26 s 18 -13 18 -26 C 37 9 29 1 19 1 z"
        fill="${color}" stroke="${ring}" stroke-width="2.5" filter="url(#s)"
      />
      <circle cx="19" cy="18" r="6" fill="white" />
    </svg>
  `
}

const restingIcon = L.divIcon({
  className: 'injectors-pin',
  html: pinSvg('rgb(63,166,138)', 'white'),
  iconSize: [38, 46],
  iconAnchor: [19, 44],
  popupAnchor: [0, -40],
})

const activeIcon = L.divIcon({
  className: 'injectors-pin injectors-pin-active',
  html: pinSvg('rgb(11,27,52)', 'rgb(63,166,138)'),
  iconSize: [46, 56],
  iconAnchor: [23, 54],
  popupAnchor: [0, -48],
})

function FitBoundsOrCenter({
  bounds,
  center,
  visible,
}: {
  bounds: LatLngBoundsExpression | null
  center: [number, number]
  visible: boolean
}) {
  const map = useMap()

  useEffect(() => {
    const id = setTimeout(() => map.invalidateSize(), 60)
    return () => clearTimeout(id)
  }, [map])

  // Re-invalidate after panel slide animation finishes (500ms) so tiles fill correctly
  useEffect(() => {
    if (!visible) return
    const id = setTimeout(() => map.invalidateSize(), 540)
    return () => clearTimeout(id)
  }, [visible, map])

  useEffect(() => {
    if (bounds && Array.isArray(bounds) && bounds.length >= 2) {
      map.flyToBounds(bounds, { padding: [60, 60], duration: 0.8, maxZoom: 12 })
    } else {
      map.flyTo(center, 11, { duration: 0.6 })
    }
  }, [bounds, center, map])

  return null
}

export function HeroMap({
  providers,
  center,
  activeProviderId,
  onPinClick,
  visible = false,
}: {
  providers: HeroProviderCard[]
  center: [number, number]
  activeProviderId: string | null
  onPinClick?: (id: string) => void
  visible?: boolean
}) {
  const valid = useMemo(
    () =>
      providers.filter(
        (p) => Number.isFinite(p.clinic.latitude) && Number.isFinite(p.clinic.longitude)
      ),
    [providers]
  )

  const bounds = useMemo<LatLngBoundsExpression | null>(() => {
    if (valid.length < 2) return null
    return valid.map((p) => [p.clinic.latitude, p.clinic.longitude] as [number, number])
  }, [valid])

  return (
    <div className="relative w-full h-[380px] md:h-[520px] rounded-2xl overflow-hidden border border-border bg-surface shadow-md">
      <MapContainer
        center={center}
        zoom={11}
        scrollWheelZoom={false}
        zoomControl={true}
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
        className="injectors-map"
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png"
          subdomains={['a', 'b', 'c', 'd']}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          maxZoom={19}
        />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
          subdomains={['a', 'b', 'c', 'd']}
          maxZoom={19}
          opacity={0.85}
        />
        <FitBoundsOrCenter bounds={bounds} center={center} visible={visible} />
        {valid.map((p) => (
          <Marker
            key={p.id}
            position={[p.clinic.latitude, p.clinic.longitude]}
            icon={activeProviderId === p.id ? activeIcon : restingIcon}
            eventHandlers={{ click: () => onPinClick?.(p.id) }}
          >
            <Popup>
              <div className="text-[12px] leading-snug min-w-[200px]">
                <div className="font-semibold text-[13px] mb-0.5">{p.fullName}</div>
                <div className="text-ink-secondary">{p.clinic.name}</div>
                <div className="text-ink-tertiary mt-1">
                  {p.clinic.neighborhood ? `${p.clinic.neighborhood}, ` : ''}
                  {p.clinic.city}, {p.clinic.state}
                </div>
                <div className="mt-2 pt-2 border-t border-border-subtle">
                  <span className="font-semibold">${p.startingPrice}</span>
                  <span className="text-ink-tertiary"> &middot; {p.aggregateRating?.toFixed(1)} ★ ({p.aggregateRatingCount})</span>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
