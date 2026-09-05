'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { SearchClinic } from '@/lib/search-queries'
import type { MapPin } from '@/components/ui/ListingMapInner'
import { LazyMapMount } from '@/components/shared/LazyMapMount'

const ListingMapInner = dynamic(
  () => import('@/components/ui/ListingMapInner').then((m) => m.ListingMapInner),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full rounded-2xl bg-surface border border-border flex items-center justify-center text-ink-tertiary text-body-sm"
        style={{ height: 360 }}
      >
        Loading map...
      </div>
    ),
  },
)

export function SearchMapSection({
  clinics = [],
}: {
  clinics?: SearchClinic[]
}) {
  /**
   * Collapsed by default (2026-09-05, founder call).
   *
   * `dynamic()` and LazyMapMount already keep the map out of the initial bundle,
   * but neither helps while the section starts open: the map mounts on load and
   * pulls ~156KB of Google Maps JS (maps-api-v3 main.js + util.js, measured on
   * staging) into every search that returns pins. The "Show map" toggle right
   * below already exists, so the map is one click away for the visitors who want
   * it, and free for everyone who does not.
   */
  const [expanded, setExpanded] = useState(false)

  const clinicPins: MapPin[] = clinics
    .filter(
      (c) =>
        Number.isFinite(c.latitude) &&
        Number.isFinite(c.longitude) &&
        c.latitude !== 0 &&
        c.longitude !== 0,
    )
    .map((c) => ({
      id: c.id,
      lat: c.latitude,
      lng: c.longitude,
      title: c.clinicName,
      subtitle: c.neighborhood || c.city,
      meta: c.aggregateRating ? `${c.aggregateRating.toFixed(1)} stars` : undefined,
      href: `/clinics/${c.stateSlug}/${c.citySlug}/${c.slug}`,
      rating: c.aggregateRating,
      price: c.startingPrice,
    }))

  const pins = clinicPins

  if (pins.length === 0) return null

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <p className="text-body-sm text-ink-secondary">{pins.length} on the map</p>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex items-center gap-1.5 rounded-control border border-border bg-surface-canvas px-4 py-1.5 text-body-sm font-medium text-ink-secondary transition hover:bg-surface"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          {expanded ? 'Hide map' : 'Show map'}
        </button>
      </div>

      {expanded && (
        <LazyMapMount
          placeholder={
            <div
              className="w-full rounded-2xl bg-surface border border-border flex items-center justify-center text-ink-tertiary text-body-sm"
              style={{ height: 360 }}
            >
              Loading map...
            </div>
          }
        >
          <ListingMapInner pins={pins} height={360} />
        </LazyMapMount>
      )}
    </div>
  )
}
