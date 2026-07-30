'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import type { SearchProvider, SearchClinic } from '@/lib/search-queries'
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
  providers,
  clinics = [],
}: {
  providers: SearchProvider[]
  clinics?: SearchClinic[]
}) {
  const [expanded, setExpanded] = useState(true)

  const providerPins: MapPin[] = providers
    .filter(
      (p) =>
        Number.isFinite(p.clinic.latitude) &&
        Number.isFinite(p.clinic.longitude) &&
        p.clinic.latitude !== 0 &&
        p.clinic.longitude !== 0,
    )
    .map((p) => ({
      id: p.id,
      lat: p.clinic.latitude,
      lng: p.clinic.longitude,
      title: p.fullName,
      subtitle: p.clinic.neighborhood || p.clinic.city,
      meta: p.aggregateRating ? `${p.aggregateRating.toFixed(1)} stars` : undefined,
      href: `/injectors/${p.clinic.stateSlug}/${p.clinic.citySlug}/${p.slug}`,
      rating: p.aggregateRating,
      price: p.startingPrice,
    }))

  // Clinics with no matching provider pin get their own marker -- this
  // directory is currently clinics-only (providers is usually empty), so
  // without this the map would never show anything on /search.
  const providerClinicIds = useMemo(() => new Set(providers.map((p) => p.clinic.id)), [providers])
  const clinicPins: MapPin[] = clinics
    .filter(
      (c) =>
        !providerClinicIds.has(c.id) &&
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

  const pins = [...providerPins, ...clinicPins]

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
