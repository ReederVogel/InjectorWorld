'use client'

import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'

/**
 * Imperative marker clustering (ROADMAP Phase 5).
 *
 * Renders pins into an L.markerClusterGroup so thousands of markers stay fast.
 * We use the leaflet.markercluster plugin directly (not a react-leaflet wrapper)
 * to avoid React 19 / react-leaflet 5 version-compat issues. Each host map keeps
 * its own icon + popup styling by passing `makeIcon` and `buildPopup`.
 *
 * Cluster bubbles are styled with brand colours via a custom iconCreateFunction
 * (so we do not depend on the plugin's Default.css blue/green/yellow palette).
 */

export type ClusterPin = {
  id: string
  lat: number
  lng: number
}

type Props<T extends ClusterPin> = {
  pins: T[]
  /** Build the marker icon for a pin (active = highlighted state). */
  makeIcon: (pin: T, active: boolean) => L.DivIcon | L.Icon
  /** Build the popup HTML for a pin. Returns null to skip the popup. */
  buildPopup: (pin: T) => string | null
  activeId?: string | null
  onPinClick?: (id: string) => void
}

function clusterIcon(count: number): L.DivIcon {
  // Size scales gently with count; navy bubble with mint ring, brand-consistent.
  const size = count < 10 ? 36 : count < 50 ? 44 : 52
  return L.divIcon({
    html:
      `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;` +
      `background:#0B1B34;color:#fff;border:2px solid #3FA68A;border-radius:9999px;` +
      `font-weight:600;font-size:13px;box-shadow:0 4px 12px rgba(11,27,52,0.25)">${count}</div>`,
    className: 'injectors-cluster',
    iconSize: [size, size],
  })
}

export function ClusterLayer<T extends ClusterPin>({
  pins,
  makeIcon,
  buildPopup,
  activeId,
  onPinClick,
}: Props<T>) {
  const map = useMap()
  const groupRef = useRef<L.MarkerClusterGroup | null>(null)
  const markersRef = useRef<Map<string, L.Marker>>(new Map())
  const pinsRef = useRef<Map<string, T>>(new Map())

  // Build / rebuild the cluster group whenever the pin set changes.
  useEffect(() => {
    const group = L.markerClusterGroup({
      chunkedLoading: true,
      showCoverageOnHover: false,
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (cluster) => clusterIcon(cluster.getChildCount()),
    })
    const markers = new Map<string, L.Marker>()
    const pinIndex = new Map<string, T>()

    for (const pin of pins) {
      if (!pin.lat || !pin.lng) continue
      const marker = L.marker([pin.lat, pin.lng], {
        icon: makeIcon(pin, activeId === pin.id),
      })
      const popup = buildPopup(pin)
      if (popup) marker.bindPopup(popup)
      marker.on('click', () => onPinClick?.(pin.id))
      markers.set(pin.id, marker)
      pinIndex.set(pin.id, pin)
      group.addLayer(marker)
    }

    map.addLayer(group)
    groupRef.current = group
    markersRef.current = markers
    pinsRef.current = pinIndex

    return () => {
      map.removeLayer(group)
      groupRef.current = null
      markersRef.current = new Map()
      pinsRef.current = new Map()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, pins])

  // Swap icons when the active pin changes (no full rebuild).
  useEffect(() => {
    for (const [id, marker] of markersRef.current) {
      const pin = pinsRef.current.get(id)
      if (pin) marker.setIcon(makeIcon(pin, activeId === id))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  return null
}
