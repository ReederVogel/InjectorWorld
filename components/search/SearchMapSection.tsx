'use client'

import dynamic from 'next/dynamic'
import type { SearchProvider } from '@/lib/search-queries'
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

export function SearchMapSection({ providers }: { providers: SearchProvider[] }) {
  const pins: MapPin[] = providers
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

  if (pins.length === 0) return null

  return (
    <div className="mb-6">
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
    </div>
  )
}
