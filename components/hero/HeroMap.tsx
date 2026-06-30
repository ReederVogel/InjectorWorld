'use client'

import 'mapbox-gl/dist/mapbox-gl.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Map, { Marker, Popup, NavigationControl } from 'react-map-gl/mapbox'
import type { MapRef } from 'react-map-gl/mapbox'
import { useTheme } from 'next-themes'
import type { HeroProviderCard } from '@/lib/hero-queries'
import type { HeroClinicCard } from './ClinicResultCard'

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

/** Clinic-only pin (no matching provider): navy fill, distinct from the mint
 * provider pin, since clinics carry less detail (no rating/price to show inline). */
function ClinicPin() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={32}
      height={40}
      viewBox="0 0 38 46"
      style={{ cursor: 'pointer', display: 'block' }}
    >
      <defs>
        <filter id="hpin-c" x="-50%" y="-30%" width="200%" height="200%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#0B1B34" floodOpacity="0.4" />
        </filter>
      </defs>
      <path
        d="M19 1 C 9 1 1 9 1 19 c 0 13 18 26 18 26 s 18 -13 18 -26 C 37 9 29 1 19 1 z"
        fill="#0B1B34"
        stroke="#3FA68A"
        strokeWidth="2.5"
        filter="url(#hpin-c)"
      />
      <circle cx="19" cy="18" r="6" fill="white" />
    </svg>
  )
}

type PopupState =
  | { kind: 'provider'; provider: HeroProviderCard; longitude: number; latitude: number }
  | { kind: 'clinic'; clinic: HeroClinicCard; longitude: number; latitude: number }

export function HeroMap({
  providers,
  clinics = [],
  center,
  activeProviderId,
  onPinClick,
  visible = false,
}: {
  providers: HeroProviderCard[]
  clinics?: HeroClinicCard[]
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

  // Clinics with no matching provider get their own pin (this directory is
  // currently clinics-only -- 0 providers -- so without this the map would
  // never show anything). Skip any clinic a provider pin already covers, so a
  // clinic with providers doesn't double up with a duplicate pin at the same spot.
  const providerClinicIds = useMemo(() => new Set(providers.map((p) => p.clinic.id)), [providers])
  const validClinics = useMemo(
    () =>
      clinics.filter(
        (c) =>
          !providerClinicIds.has(c.id) &&
          Number.isFinite(c.latitude) &&
          Number.isFinite(c.longitude) &&
          c.latitude >= -90 && c.latitude <= 90 &&
          c.longitude >= -180 && c.longitude <= 180,
      ),
    [clinics, providerClinicIds],
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
    const points = [
      ...valid.map((p) => [p.clinic.longitude, p.clinic.latitude] as [number, number]),
      ...validClinics.map((c) => [c.longitude, c.latitude] as [number, number]),
    ]
    if (!map || points.length === 0) return
    if (points.length === 1) {
      map.flyTo({ center: points[0], zoom: 13, duration: 600 })
    } else {
      const lngs = points.map(([lng]) => lng)
      const lats = points.map(([, lat]) => lat)
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 60, maxZoom: 12, duration: 800 },
      )
    }
  }, [valid, validClinics])

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
            key={`p-${p.id}`}
            longitude={p.clinic.longitude}
            latitude={p.clinic.latitude}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation()
              onPinClick?.(p.id)
              setPopup({ kind: 'provider', provider: p, longitude: p.clinic.longitude, latitude: p.clinic.latitude })
            }}
          >
            <Pin active={activeProviderId === p.id} />
          </Marker>
        ))}
        {validClinics.map((c) => (
          <Marker
            key={`c-${c.id}`}
            longitude={c.longitude}
            latitude={c.latitude}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation()
              setPopup({ kind: 'clinic', clinic: c, longitude: c.longitude, latitude: c.latitude })
            }}
          >
            <ClinicPin />
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
            {popup.kind === 'provider' ? (
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
            ) : (
              <div className="min-w-[200px] text-[12px] leading-snug">
                <div className="font-semibold text-[13px] mb-0.5 text-ink-primary">
                  {popup.clinic.name}
                </div>
                <div className="text-ink-tertiary mt-1">
                  {popup.clinic.neighborhood ? `${popup.clinic.neighborhood}, ` : ''}
                  {popup.clinic.city}, {popup.clinic.state}
                </div>
                {popup.clinic.aggregateRating ? (
                  <div className="mt-2 pt-2 border-t border-border-subtle text-ink-tertiary">
                    {popup.clinic.aggregateRating.toFixed(1)} ★ ({popup.clinic.aggregateRatingCount})
                  </div>
                ) : null}
              </div>
            )}
          </Popup>
        )}
      </Map>
    </div>
  )
}
