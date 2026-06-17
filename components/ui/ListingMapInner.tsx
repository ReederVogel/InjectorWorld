'use client'

import 'mapbox-gl/dist/mapbox-gl.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MapGL, { Source, Layer, Popup, NavigationControl } from 'react-map-gl/mapbox'
import type { MapRef } from 'react-map-gl/mapbox'
import type { MapMouseEvent, GeoJSONSource, GeoJSONFeature } from 'mapbox-gl'
import { useTheme } from 'next-themes'

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

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
const LIGHT_STYLE = 'mapbox://styles/mapbox/light-v11'
const DARK_STYLE = 'mapbox://styles/mapbox/dark-v11'

type PopupState = { pin: MapPin; longitude: number; latitude: number }

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
  const mapRef = useRef<MapRef>(null)
  const { resolvedTheme } = useTheme()
  const [popup, setPopup] = useState<PopupState | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const fittedRef = useRef(false)

  const mapStyle = resolvedTheme === 'dark' ? DARK_STYLE : LIGHT_STYLE

  const valid = useMemo(() => pins.filter((p) => p.lat !== 0 && p.lng !== 0), [pins])

  const pinMap = useMemo(() => new globalThis.Map(valid.map((p) => [p.id, p] as [string, MapPin])), [valid])

  const initCenter = useMemo<[number, number]>(() => {
    if (valid.length === 0) return [-74.006, 40.7128]
    const lng = valid.reduce((s, p) => s + p.lng, 0) / valid.length
    const lat = valid.reduce((s, p) => s + p.lat, 0) / valid.length
    return [lng, lat]
  }, [valid])

  const geojsonData = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: valid.map((p) => ({
        type: 'Feature' as const,
        properties: { id: p.id },
        geometry: {
          type: 'Point' as const,
          coordinates: [p.lng, p.lat] as [number, number],
        },
      })),
    }),
    [valid],
  )

  const unclusteredPaint = useMemo(
    () => ({
      'circle-color': [
        'case',
        ['==', ['get', 'id'], activePinId ?? ''],
        '#0B1B34',
        '#3FA68A',
      ],
      'circle-radius': ['case', ['==', ['get', 'id'], activePinId ?? ''], 10, 8],
      'circle-stroke-width': 2,
      'circle-stroke-color': [
        'case',
        ['==', ['get', 'id'], activePinId ?? ''],
        '#3FA68A',
        'white',
      ],
    }),
    [activePinId],
  )

  const handleLoad = useCallback(() => setMapLoaded(true), [])

  // Fit bounds only once on first load
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || valid.length === 0 || fittedRef.current) return
    fittedRef.current = true
    if (valid.length === 1) {
      mapRef.current.flyTo({ center: [valid[0].lng, valid[0].lat], zoom: 13 })
    } else {
      const lngs = valid.map((p) => p.lng)
      const lats = valid.map((p) => p.lat)
      mapRef.current.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 60, maxZoom: 13 },
      )
    }
  }, [mapLoaded, valid])

  // resize() is called by consumers (city clinic tab, List/Map toggle) via a visible prop pattern;
  // here we expose it on mount so the parent can trigger it if needed.
  useEffect(() => {
    return () => {
      fittedRef.current = false
    }
  }, [])

  const handleClick = useCallback(
    (e: MapMouseEvent) => {
      const map = mapRef.current
      if (!map) return
      const features = map.getMap().queryRenderedFeatures(e.point, {
        layers: ['listing-clusters', 'listing-unclustered'],
      }) as GeoJSONFeature[]
      if (!features.length) return
      const feature = features[0]

      if (feature.layer?.id === 'listing-clusters') {
        const clusterId = (feature.properties as { cluster_id: number }).cluster_id
        ;(map.getMap().getSource('listing-pins') as GeoJSONSource).getClusterExpansionZoom(
          clusterId,
          (err, zoom) => {
            if (err || zoom == null) return
            const geo = feature.geometry as unknown as { coordinates: [number, number] }
            map.flyTo({ center: geo.coordinates, zoom })
          },
        )
        return
      }

      if (feature.layer?.id === 'listing-unclustered') {
        const id = (feature.properties as { id: string }).id
        if (!id) return
        onPinClick?.(id)
        const pin = pinMap.get(id)
        if (pin) setPopup({ pin, longitude: pin.lng, latitude: pin.lat })
      }
    },
    [onPinClick, pinMap],
  )

  const handleMouseEnter = useCallback(() => {
    if (mapRef.current) mapRef.current.getCanvas().style.cursor = 'pointer'
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (mapRef.current) mapRef.current.getCanvas().style.cursor = ''
  }, [])

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

  if (!TOKEN) {
    return (
      <div
        className="w-full rounded-2xl bg-surface border border-border flex items-center justify-center text-ink-tertiary text-body-sm"
        style={{ height }}
      >
        Map unavailable
      </div>
    )
  }

  return (
    <div className="injectors-map rounded-2xl overflow-hidden border border-border shadow-md" style={{ height }}>
      <MapGL
        ref={mapRef}
        mapboxAccessToken={TOKEN}
        mapStyle={mapStyle}
        initialViewState={{ longitude: initCenter[0], latitude: initCenter[1], zoom: 11 }}
        scrollZoom={false}
        attributionControl={false}
        onLoad={handleLoad}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        interactiveLayerIds={['listing-clusters', 'listing-unclustered']}
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="top-right" showCompass={false} />

        <Source
          id="listing-pins"
          type="geojson"
          data={geojsonData}
          cluster
          clusterMaxZoom={14}
          clusterRadius={50}
        >
          <Layer
            id="listing-clusters"
            type="circle"
            filter={['has', 'point_count']}
            paint={{
              'circle-color': '#0B1B34',
              'circle-radius': [
                'step',
                ['get', 'point_count'],
                18,
                10,
                22,
                50,
                26,
              ] as unknown as number,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#3FA68A',
            }}
          />
          <Layer
            id="listing-cluster-count"
            type="symbol"
            filter={['has', 'point_count']}
            layout={{
              'text-field': ['get', 'point_count_abbreviated'] as unknown as string,
              'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
              'text-size': 13,
            }}
            paint={{ 'text-color': '#ffffff' }}
          />
          <Layer
            id="listing-unclustered"
            type="circle"
            filter={['!', ['has', 'point_count']]}
            paint={unclusteredPaint as unknown as import('mapbox-gl').CirclePaint}
          />
        </Source>

        {popup && (
          <Popup
            longitude={popup.longitude}
            latitude={popup.latitude}
            anchor="bottom"
            onClose={() => setPopup(null)}
            closeButton
            closeOnClick={false}
          >
            <a
              href={popup.pin.href}
              style={{ display: 'block', minWidth: 180, textDecoration: 'none' }}
            >
              <div style={{ fontWeight: 600, fontSize: 13, color: '#0B1B34', marginBottom: 2, lineHeight: 1.3 }}>
                {popup.pin.title}
              </div>
              {popup.pin.subtitle && (
                <div style={{ fontSize: 11, color: '#475569' }}>{popup.pin.subtitle}</div>
              )}
              {popup.pin.meta && (
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{popup.pin.meta}</div>
              )}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 8,
                  paddingTop: 8,
                  borderTop: '1px solid #EEF1F5',
                }}
              >
                {popup.pin.rating ? (
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#0B1B34' }}>
                    &#9733; {popup.pin.rating.toFixed(1)}
                  </span>
                ) : null}
                {popup.pin.price ? (
                  <span style={{ fontSize: 11, color: '#475569' }}>from ${popup.pin.price}</span>
                ) : null}
                <span style={{ fontSize: 11, color: '#3FA68A', marginLeft: 'auto' }}>
                  View &rarr;
                </span>
              </div>
            </a>
          </Popup>
        )}
      </MapGL>
    </div>
  )
}
