'use client'

import 'mapbox-gl/dist/mapbox-gl.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Map, { Marker, Popup, NavigationControl } from 'react-map-gl/mapbox'
import type { MapRef } from 'react-map-gl/mapbox'
import { useTheme } from 'next-themes'
import type { HeroProviderCard } from '@/lib/hero-queries'

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
const LIGHT_STYLE = 'mapbox://styles/mapbox/light-v11'
const DARK_STYLE = 'mapbox://styles/mapbox/dark-v11'

function Pin({ active }: { active: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={active ? 46 : 38}
      height={active ? 56 : 46}
      viewBox="0 0 38 46"
      style={{ cursor: 'pointer', display: 'block' }}
    >
      <defs>
        <filter id="hpin-s" x="-50%" y="-30%" width="200%" height="200%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#0B1B34" floodOpacity="0.4" />
        </filter>
      </defs>
      <path
        d="M19 1 C 9 1 1 9 1 19 c 0 13 18 26 18 26 s 18 -13 18 -26 C 37 9 29 1 19 1 z"
        fill={active ? '#0B1B34' : '#3FA68A'}
        stroke={active ? '#3FA68A' : 'white'}
        strokeWidth="2.5"
        filter="url(#hpin-s)"
      />
      <circle cx="19" cy="18" r="6" fill="white" />
    </svg>
  )
}

type PopupState = {
  provider: HeroProviderCard
  longitude: number
  latitude: number
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
  const mapRef = useRef<MapRef>(null)
  const { resolvedTheme } = useTheme()
  const [popup, setPopup] = useState<PopupState | null>(null)

  const mapStyle = resolvedTheme === 'dark' ? DARK_STYLE : LIGHT_STYLE

  const valid = useMemo(
    () =>
      providers.filter(
        (p) =>
          Number.isFinite(p.clinic.latitude) &&
          Number.isFinite(p.clinic.longitude) &&
          p.clinic.latitude >= -90 && p.clinic.latitude <= 90 &&
          p.clinic.longitude >= -180 && p.clinic.longitude <= 180,
      ),
    [providers],
  )

  useEffect(() => {
    if (!visible) return
    const t1 = setTimeout(() => mapRef.current?.resize(), 60)
    const t2 = setTimeout(() => mapRef.current?.resize(), 540)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [visible])

  const handleLoad = useCallback(() => {
    const map = mapRef.current
    if (!map || valid.length === 0) return
    if (valid.length === 1) {
      map.flyTo({
        center: [valid[0].clinic.longitude, valid[0].clinic.latitude],
        zoom: 13,
        duration: 600,
      })
    } else {
      const lngs = valid.map((p) => p.clinic.longitude)
      const lats = valid.map((p) => p.clinic.latitude)
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 60, maxZoom: 12, duration: 800 },
      )
    }
  }, [valid])

  if (!TOKEN) {
    return (
      <div className="relative w-full h-[380px] md:h-[520px] rounded-2xl overflow-hidden border border-border bg-surface shadow-md flex items-center justify-center">
        <p className="text-ink-tertiary text-body-sm">Map unavailable</p>
      </div>
    )
  }

  return (
    <div className="injectors-map relative w-full h-[380px] md:h-[520px] rounded-2xl overflow-hidden border border-border bg-surface shadow-md">
      <Map
        ref={mapRef}
        mapboxAccessToken={TOKEN}
        mapStyle={mapStyle}
        initialViewState={{ longitude: center[1], latitude: center[0], zoom: 11 }}
        scrollZoom={false}
        attributionControl={false}
        onLoad={handleLoad}
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="top-right" showCompass={false} />
        {valid.map((p) => (
          <Marker
            key={p.id}
            longitude={p.clinic.longitude}
            latitude={p.clinic.latitude}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation()
              onPinClick?.(p.id)
              setPopup({
                provider: p,
                longitude: p.clinic.longitude,
                latitude: p.clinic.latitude,
              })
            }}
          >
            <Pin active={activeProviderId === p.id} />
          </Marker>
        ))}
        {popup && (
          <Popup
            longitude={popup.longitude}
            latitude={popup.latitude}
            anchor="bottom"
            onClose={() => setPopup(null)}
            closeButton
            closeOnClick={false}
          >
            <div className="min-w-[200px] text-[12px] leading-snug">
              <div className="font-semibold text-[13px] mb-0.5 text-ink-primary">
                {popup.provider.fullName}
              </div>
              <div className="text-ink-secondary">{popup.provider.clinic.name}</div>
              <div className="text-ink-tertiary mt-1">
                {popup.provider.clinic.neighborhood
                  ? `${popup.provider.clinic.neighborhood}, `
                  : ''}
                {popup.provider.clinic.city}, {popup.provider.clinic.state}
              </div>
              <div className="mt-2 pt-2 border-t border-border-subtle">
                <span className="font-semibold text-ink-primary">
                  ${popup.provider.startingPrice}
                </span>
                <span className="text-ink-tertiary">
                  {' '}
                  &middot; {popup.provider.aggregateRating?.toFixed(1)} ★ (
                  {popup.provider.aggregateRatingCount})
                </span>
              </div>
            </div>
          </Popup>
        )}
      </Map>
    </div>
  )
}
