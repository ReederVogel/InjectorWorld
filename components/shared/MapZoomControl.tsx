'use client'

import { ControlPosition, MapControl, useMap } from '@vis.gl/react-google-maps'

/**
 * Custom zoom control, styled to match the site's design tokens.
 *
 * Google's default zoom control is skinned via internal classnames that are
 * not a stable public API (they can change on any Maps JS release), so
 * `disableDefaultUI` + this component fully replaces it instead of trying to
 * override it with CSS -- the same visual result (rounded button group,
 * hover state, divider) as the old Mapbox NavigationControl, without relying
 * on undocumented DOM structure.
 */
export function MapZoomControl() {
  const map = useMap()
  if (!map) return null

  const zoomBy = (delta: number) => {
    const current = map.getZoom() ?? 12
    map.setZoom(current + delta)
  }

  return (
    <MapControl position={ControlPosition.RIGHT_TOP}>
      <div className="m-3 flex flex-col overflow-hidden rounded-control border border-border bg-surface-canvas shadow-md">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => zoomBy(1)}
          className="flex h-[30px] w-[30px] items-center justify-center text-ink-primary transition hover:bg-brand-accent-soft"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
        </button>
        <div className="h-px bg-border-subtle" />
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => zoomBy(-1)}
          className="flex h-[30px] w-[30px] items-center justify-center text-ink-primary transition hover:bg-brand-accent-soft"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12h14" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </MapControl>
  )
}
