'use client'

import { useEffect, useMemo, useState } from 'react'
import { APIProvider, InfoWindow, Map, Marker, useMap } from '@vis.gl/react-google-maps'
import { useTheme } from 'next-themes'
import type { HeroClinicCard } from './ClinicResultCard'
import { MapZoomControl } from '@/components/shared/MapZoomControl'
import { DARK_MAP_STYLE, LIGHT_MAP_STYLE } from '@/lib/maps/theme'
import { svgToDataUrl } from '@/lib/maps/svg-icon'

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

function pinShadowDefs(id: string) {
  return `<defs><filter id="${id}" x="-50%" y="-30%" width="200%" height="200%"><feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#0B1B34" flood-opacity="0.4"/></filter></defs>`
}

/** Clinic pin: navy fill with a mint outline. */
const CLINIC_PIN = svgToDataUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 38 46">` +
    pinShadowDefs('hpin-c') +
    `<path d="M19 1 C 9 1 1 9 1 19 c 0 13 18 26 18 26 s 18 -13 18 -26 C 37 9 29 1 19 1 z" fill="#0B1B34" stroke="#3FA68A" stroke-width="2.5" filter="url(#hpin-c)"/>` +
    `<circle cx="19" cy="18" r="6" fill="#FFFFFF"/></svg>`,
)

type PopupState = { kind: 'clinic'; clinic: HeroClinicCard; longitude: number; latitude: number }

export function HeroMap({
  clinics = [],
  center,
  activeClinicId,
  onPinClick,
  visible = false,
}: {
  clinics?: HeroClinicCard[]
  center: [number, number]
  activeClinicId: string | null
  onPinClick?: (id: string) => void
  visible?: boolean
}) {
  const { resolvedTheme } = useTheme()
  const mapStyle = resolvedTheme === 'dark' ? DARK_MAP_STYLE : LIGHT_MAP_STYLE

  const validClinics = useMemo(
    () =>
      clinics.filter(
        (c) =>
          Number.isFinite(c.latitude) &&
          Number.isFinite(c.longitude) &&
          c.latitude >= -90 && c.latitude <= 90 &&
          c.longitude >= -180 && c.longitude <= 180,
      ),
    [clinics],
  )

  if (!API_KEY) {
    return (
      <div className="relative w-full h-[380px] md:h-[520px] rounded-2xl overflow-hidden border border-border bg-surface shadow-md flex items-center justify-center">
        <p className="text-ink-tertiary text-body-sm">Map unavailable</p>
      </div>
    )
  }

  return (
    <div className="injectors-map relative w-full h-[380px] md:h-[520px] rounded-2xl overflow-hidden border border-border bg-surface shadow-md">
      <APIProvider apiKey={API_KEY}>
        <Map
          defaultCenter={{ lat: center[0], lng: center[1] }}
          defaultZoom={11}
          gestureHandling="cooperative"
          disableDefaultUI
          clickableIcons={false}
          styles={mapStyle}
          className="h-full w-full"
        >
          <MapZoomControl />
          <HeroMapContent
            clinics={validClinics}
            center={center}
            activeClinicId={activeClinicId}
            onPinClick={onPinClick}
            visible={visible}
          />
        </Map>
      </APIProvider>
    </div>
  )
}

function HeroMapContent({
  clinics,
  center,
  activeClinicId,
  onPinClick,
  visible,
}: {
  clinics: HeroClinicCard[]
  center: [number, number]
  activeClinicId: string | null
  onPinClick?: (id: string) => void
  visible: boolean
}) {
  const map = useMap()
  const [popup, setPopup] = useState<PopupState | null>(null)

  // The map container can mount while hidden (e.g. an inactive tab), which
  // leaves Google Maps' internal size cache stale once it becomes visible --
  // without this it stays pinned to whatever (possibly zero) size it had at
  // construction time.
  useEffect(() => {
    if (!visible || !map) return
    const t1 = setTimeout(() => google.maps.event.trigger(map, 'resize'), 60)
    const t2 = setTimeout(() => google.maps.event.trigger(map, 'resize'), 540)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [visible, map])

  // Re-fit the camera on initial load AND on every subsequent search
  // (data/center change).
  useEffect(() => {
    if (!map) return
    const points = clinics.map((c) => ({ lat: c.latitude, lng: c.longitude }))
    if (points.length === 0) {
      // No pins to fit -- still move to the resolved/typed location (the
      // `center` prop) rather than leaving the map wherever it was.
      map.panTo({ lat: center[0], lng: center[1] })
      map.setZoom(11)
      return
    }
    if (points.length === 1) {
      map.panTo(points[0])
      map.setZoom(13)
      return
    }
    const bounds = new google.maps.LatLngBounds()
    points.forEach((pt) => bounds.extend(pt))
    map.fitBounds(bounds, 60)
    const listener = google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
      if ((map.getZoom() ?? 0) > 12) map.setZoom(12)
    })
    return () => google.maps.event.removeListener(listener)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, clinics, center])

  return (
    <>
      {clinics.map((c) => (
        <Marker
          key={`c-${c.id}`}
          position={{ lat: c.latitude, lng: c.longitude }}
          icon={CLINIC_PIN}
          title={c.name}
          onClick={() => {
            onPinClick?.(c.id)
            setPopup({ kind: 'clinic', clinic: c, longitude: c.longitude, latitude: c.latitude })
          }}
        />
      ))}
      {popup && (
        <InfoWindow
          position={{ lat: popup.latitude, lng: popup.longitude }}
          headerDisabled
          onClose={() => setPopup(null)}
        >
          <div className="relative min-w-[200px] p-3 pr-7 text-[12px] leading-snug">
            <button
              type="button"
              aria-label="Close"
              onClick={() => setPopup(null)}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full text-ink-tertiary hover:bg-brand-accent-soft hover:text-ink-primary"
            >
              &times;
            </button>
            <>
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
            </>
          </div>
        </InfoWindow>
      )}
    </>
  )
}
