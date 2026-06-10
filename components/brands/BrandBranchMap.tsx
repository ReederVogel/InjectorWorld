'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import type { MapPin } from '@/components/ui/ListingMapInner'

const ListingMapInner = dynamic(
  () => import('@/components/ui/ListingMapInner').then((m) => m.ListingMapInner),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full rounded-2xl bg-surface border border-border flex items-center justify-center text-ink-tertiary text-body-sm"
        style={{ height: 420 }}
      >
        Loading map…
      </div>
    ),
  },
)

/**
 * A lightweight map of every branch under a brand. The branch list itself is
 * server-rendered for SEO; this is the visual companion. No filtering — a brand
 * has a small, fixed set of locations.
 */
export function BrandBranchMap({ pins }: { pins: MapPin[] }) {
  const [activePin, setActivePin] = useState<string | null>(null)
  if (pins.length === 0) return null
  return (
    <div>
      <ListingMapInner pins={pins} activePinId={activePin} onPinClick={setActivePin} height={420} />
      <p className="text-caption text-ink-tertiary mt-2 text-center">
        {pins.length} {pins.length === 1 ? 'location' : 'locations'}. Click a pin to see the branch.
      </p>
    </div>
  )
}
