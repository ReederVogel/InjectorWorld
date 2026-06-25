'use client'

import 'mapbox-gl/dist/mapbox-gl.css'
import { LazyMapMount } from '@/components/shared/LazyMapMount'
import MapGL, { Marker, NavigationControl } from 'react-map-gl/mapbox'
import { useTheme } from 'next-themes'

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
const LIGHT_STYLE = 'mapbox://styles/mapbox/light-v11'
const DARK_STYLE = 'mapbox://styles/mapbox/dark-v11'

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
  const mapStyle = resolvedTheme === 'dark' ? DARK_STYLE : LIGHT_STYLE

  if (!TOKEN) {
    return (
      <div className="flex h-[400px] w-full items-center justify-center rounded-2xl border border-border bg-surface text-body-sm text-ink-tertiary">
        Map unavailable
      </div>
    )
  }

  return (
    <div className="relative h-[400px] overflow-hidden rounded-2xl border border-border bg-surface shadow-md">
      <MapGL
        mapboxAccessToken={TOKEN}
        mapStyle={mapStyle}
        initialViewState={{ longitude, latitude, zoom: 14 }}
        scrollZoom={false}
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <Marker longitude={longitude} latitude={latitude} anchor="bottom">
          <div className="flex h-10 w-10 items-center justify-center rounded-pill bg-brand-primary text-surface-canvas shadow-lg ring-2 ring-brand-accent">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span className="sr-only">{clinicName}</span>
          </div>
        </Marker>
      </MapGL>
      {directionsUrl && (
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-4 left-4 inline-flex min-h-11 items-center justify-center rounded-pill bg-surface-canvas px-5 py-2.5 text-body-sm font-semibold text-ink-primary shadow-md transition hover:text-brand-accent"
        >
          Get directions
        </a>
      )}
    </div>
  )
}
