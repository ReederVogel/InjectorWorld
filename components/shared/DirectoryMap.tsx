'use client'

import 'mapbox-gl/dist/mapbox-gl.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MapGL, { Source, Layer, Popup, NavigationControl } from 'react-map-gl/mapbox'
import type { MapRef } from 'react-map-gl/mapbox'
import type { MapMouseEvent, GeoJSONSource, GeoJSONFeature } from 'mapbox-gl'
import { useTheme } from 'next-themes'
import type { DirectoryProvider } from '@/lib/location-queries'

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
const LIGHT_STYLE = 'mapbox://styles/mapbox/light-v11'
const DARK_STYLE = 'mapbox://styles/mapbox/dark-v11'

type PopupState = { provider: DirectoryProvider; longitude: number; latitude: number }

type Props = {
  providers: DirectoryProvider[]
  activeId?: string | null
  onPinClick?: (id: string) => void
  height?: string
  className?: string
}

export function DirectoryMap({
  providers,
  activeId,
  onPinClick,
  height = '360px',
  className,
}: Props) {
  const mapRef = useRef<MapRef>(null)
  const { resolvedTheme } = useTheme()
  const [popup, setPopup] = useState<PopupState | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

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

  const providerMap = useMemo(() => new globalThis.Map(valid.map((p) => [p.id, p] as [string, DirectoryProvider])), [valid])

  const geojsonData = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: valid.map((p) => ({
        type: 'Feature' as const,
        properties: { id: p.id },
        geometry: {
          type: 'Point' as const,
          coordinates: [p.clinic.longitude, p.clinic.latitude] as [number, number],
        },
      })),
    }),
    [valid],
  )

  const unclusteredPaint = useMemo(
    () => ({
      'circle-color': ['case', ['==', ['get', 'id'], activeId ?? ''], '#0B1B34', '#3FA68A'],
      'circle-radius': ['case', ['==', ['get', 'id'], activeId ?? ''], 10, 8],
      'circle-stroke-width': 2,
      'circle-stroke-color': [
        'case',
        ['==', ['get', 'id'], activeId ?? ''],
        '#3FA68A',
        'white',
      ],
    }),
    [activeId],
  )

  const handleLoad = useCallback(() => setMapLoaded(true), [])

  // Re-fit bounds whenever the provider set changes
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || valid.length === 0) return
    if (valid.length === 1) {
      mapRef.current.flyTo({
        center: [valid[0].clinic.longitude, valid[0].clinic.latitude],
        zoom: 13,
      })
    } else {
      const lngs = valid.map((p) => p.clinic.longitude)
      const lats = valid.map((p) => p.clinic.latitude)
      mapRef.current.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 48, maxZoom: 13 },
      )
    }
  }, [mapLoaded, valid])

  const handleClick = useCallback(
    (e: MapMouseEvent) => {
      const map = mapRef.current
      if (!map) return
      const features = map.getMap().queryRenderedFeatures(e.point, {
        layers: ['clusters', 'unclustered-point'],
      }) as GeoJSONFeature[]
      if (!features.length) return
      const feature = features[0]

      if (feature.layer?.id === 'clusters') {
        const clusterId = (feature.properties as { cluster_id: number }).cluster_id
        ;(map.getMap().getSource('providers') as GeoJSONSource).getClusterExpansionZoom(
          clusterId,
          (err, zoom) => {
            if (err || zoom == null) return
            const geo = feature.geometry as unknown as { coordinates: [number, number] }
            map.flyTo({ center: geo.coordinates, zoom })
          },
        )
        return
      }

      if (feature.layer?.id === 'unclustered-point') {
        const id = (feature.properties as { id: string }).id
        if (!id) return
        onPinClick?.(id)
        const p = providerMap.get(id)
        if (p)
          setPopup({ provider: p, longitude: p.clinic.longitude, latitude: p.clinic.latitude })
      }
    },
    [onPinClick, providerMap],
  )

  const handleMouseEnter = useCallback(() => {
    if (mapRef.current) mapRef.current.getCanvas().style.cursor = 'pointer'
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (mapRef.current) mapRef.current.getCanvas().style.cursor = ''
  }, [])

  const initCenter: [number, number] =
    valid.length > 0
      ? [valid[0].clinic.longitude, valid[0].clinic.latitude]
      : [-74.006, 40.7128]

  if (!TOKEN) {
    return (
      <div
        style={{ height }}
        className={
          className ??
          'rounded-xl overflow-hidden border border-border shadow-sm flex items-center justify-center bg-surface'
        }
      >
        <p className="text-ink-tertiary text-body-sm">Map unavailable</p>
      </div>
    )
  }

  return (
    <div
      style={{ height }}
      className={`injectors-map ${className ?? 'rounded-xl overflow-hidden border border-border shadow-sm'}`}
    >
      <MapGL
        ref={mapRef}
        mapboxAccessToken={TOKEN}
        mapStyle={mapStyle}
        initialViewState={{ longitude: initCenter[0], latitude: initCenter[1], zoom: 12 }}
        scrollZoom={false}
        attributionControl={false}
        onLoad={handleLoad}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        interactiveLayerIds={['clusters', 'unclustered-point']}
        style={{ height: '100%', width: '100%' }}
      >
        <NavigationControl position="top-right" showCompass={false} />

        <Source
          id="providers"
          type="geojson"
          data={geojsonData}
          cluster
          clusterMaxZoom={14}
          clusterRadius={50}
        >
          <Layer
            id="clusters"
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
            id="cluster-count"
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
            id="unclustered-point"
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
            {/* inline styles keep popup readable in both themes — popup bg is overridden in globals.css */}
            <div style={{ display: 'flex', gap: 8, minWidth: 180 }}>
              {popup.provider.profilePhotoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={popup.provider.profilePhotoUrl}
                  alt={popup.provider.fullName}
                  width={36}
                  height={36}
                  style={{ borderRadius: '9999px', objectFit: 'cover', flexShrink: 0 }}
                />
              )}
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#0B1B34', lineHeight: 1.2 }}>
                  {popup.provider.fullName}
                </div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                  {popup.provider.clinic.neighborhood || popup.provider.clinic.city}
                </div>
                {popup.provider.aggregateRating ? (
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                    {popup.provider.aggregateRating.toFixed(1)} stars
                  </div>
                ) : null}
                <a
                  href={`/injectors/${popup.provider.clinic.citySlug}/${popup.provider.slug}`}
                  style={{
                    display: 'block',
                    marginTop: 6,
                    fontSize: 11,
                    color: '#3FA68A',
                    fontWeight: 500,
                    textDecoration: 'none',
                  }}
                >
                  View profile
                </a>
              </div>
            </div>
          </Popup>
        )}
      </MapGL>
    </div>
  )
}
