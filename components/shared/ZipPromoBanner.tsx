'use client'

import { useEffect, useState } from 'react'
import { PromoBanner } from './PromoBanner'
import type { ActiveBanner } from '@/lib/promotions'

type Props = {
  /** Server-rendered page-scope banner (if any) to show until/unless a closer ZIP match is found. */
  fallback: ActiveBanner | null
  /** Current page's service id, if this is a service-scoped page. */
  serviceId?: string
}

/**
 * Progressive enhancement over PromoBanner: after hydration, resolves the
 * visitor's approximate location (IP geolocation) and checks for a
 * ZIP-radius-scoped promotion nearer to them than the page-scope banner.
 * Runs client-side so it never affects the page's own ISR/SSG caching.
 */
export function ZipPromoBanner({ fallback, serviceId }: Props) {
  const [banner, setBanner] = useState<ActiveBanner | null>(fallback)

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        const geoRes = await fetch('/api/geo/ip')
        const geo = await geoRes.json()
        if (geo.lat == null || geo.lng == null) return

        const params = new URLSearchParams({ lat: String(geo.lat), lng: String(geo.lng) })
        if (serviceId) params.set('serviceId', serviceId)

        const zipRes = await fetch(`/api/promotions/zip-nearby?${params.toString()}`)
        const zipData = await zipRes.json()
        if (!cancelled && zipData?.banner) setBanner(zipData.banner)
      } catch {
        // Network/geo failure: keep whatever fallback banner was already rendered.
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [serviceId])

  return <PromoBanner banner={banner} />
}
