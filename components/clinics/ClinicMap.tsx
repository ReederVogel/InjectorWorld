'use client'

import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps'
import { LazyMapMount } from '@/components/shared/LazyMapMount'
import { MapZoomControl } from '@/components/shared/MapZoomControl'
import { useTheme } from 'next-themes'
import { DARK_MAP_STYLE, LIGHT_MAP_STYLE } from '@/lib/maps/theme'
import { svgToDataUrl } from '@/lib/maps/svg-icon'

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

// Same circle-pin design as before, baked into an SVG icon (bottom-center
// anchor by default -- matches the old Mapbox <Marker anchor="bottom">).
const PIN_ICON = svgToDataUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">` +
    `<circle cx="20" cy="20" r="18" fill="#0B1B34" stroke="#3FA68A" stroke-width="2.5"/>` +
    `<g transform="translate(11,11) scale(0.75)" fill="none" stroke="#FFFFFF" stroke-width="2.5">` +
    `<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>` +
    `<circle cx="12" cy="10" r="3"/>` +
    `</g></svg>`,
)

export function ClinicMap({
  clinicName,
  latitude,
  longitude,
  directionsUrl,
}: {
  clinicName: string
  latitude: number
  longitude: number
  directionsUrl?: string
}) {
  return (
    <LazyMapMount
      className="relative"
      placeholder={
        <div className="flex h-[400px] w-full items-center justify-center rounded-2xl border border-border bg-surface text-body-sm text-ink-tertiary">
          Loading map
        </div>
      }
      rootMargin="200px"
    >
      <ClinicMapInner
        clinicName={clinicName}
        latitude={latitude}
        longitude={longitude}
        directionsUrl={directionsUrl}
      />
    </LazyMapMount>
  )
}

function ClinicMapInner({
  clinicName,
  latitude,
  longitude,
  directionsUrl,
}: {
  clinicName: string
  latitude: number
  longitude: number
  directionsUrl?: string
}) {
  const { resolvedTheme } = useTheme()
  const mapStyle = resolvedTheme === 'dark' ? DARK_MAP_STYLE : LIGHT_MAP_STYLE

  if (!API_KEY) {
    return (
      <div className="flex h-[400px] w-full items-center justify-center rounded-2xl border border-border bg-surface text-body-sm text-ink-tertiary">
        Map unavailable
      </div>
    )
  }

  return (
    <div className="injectors-map relative h-[400px] overflow-hidden rounded-2xl border border-border bg-surface shadow-md">
      <APIProvider apiKey={API_KEY}>
        <Map
          defaultCenter={{ lat: latitude, lng: longitude }}
          defaultZoom={14}
          gestureHandling="cooperative"
          disableDefaultUI
          clickableIcons={false}
          styles={mapStyle}
          className="h-full w-full"
        >
          <MapZoomControl />
          <Marker position={{ lat: latitude, lng: longitude }} icon={PIN_ICON} title={clinicName} />
        </Map>
      </APIProvider>
      {directionsUrl && (
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-4 left-4 inline-flex min-h-11 items-center justify-center rounded-control bg-surface-canvas px-5 py-2.5 text-body-sm font-semibold text-ink-primary shadow-md transition hover:text-brand-accent"
        >
          Get directions
        </a>
      )}
    </div>
  )
}
