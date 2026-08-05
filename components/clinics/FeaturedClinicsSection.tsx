'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DirectoryClinicCard } from '@/components/shared/DirectoryClinicCard'
import type { TopClinicRow } from '@/lib/home-queries'

type ClinicCardData = TopClinicRow & { distanceMiles?: number }

/**
 * Turns a geo-IP result into a human label, e.g. "Houston, TX 77098".
 * Returns null when there isn't enough to name a place, so the caller falls
 * back to the generic heading instead of showing a half-empty location.
 */
function placeLabel(geo: { city?: unknown; stateCode?: unknown; zip?: unknown }): string | null {
  const city = typeof geo.city === 'string' && geo.city ? geo.city : null
  const stateCode = typeof geo.stateCode === 'string' && geo.stateCode ? geo.stateCode : null
  const zip = typeof geo.zip === 'string' && geo.zip ? geo.zip : null
  if (!city) return null
  const cityState = stateCode ? `${city}, ${stateCode}` : city
  return zip ? `${cityState} ${zip}` : cityState
}

export function FeaturedClinicsSection({ fallback }: { fallback: TopClinicRow[] }) {
  const [clinics, setClinics] = useState<ClinicCardData[]>(fallback)
  const [isNearby, setIsNearby] = useState(false)
  const [place, setPlace] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/geo/ip')
      .then((r) => r.json())
      .then((geo) => {
        if (cancelled || geo.lat == null || geo.lng == null) return null
        return fetch(`/api/home/nearby-clinics?lat=${geo.lat}&lng=${geo.lng}`)
          .then((r) => r.json())
          .then((data) => ({ data, label: placeLabel(geo) }))
      })
      .then((res) => {
        if (cancelled || !res) return
        if (Array.isArray(res.data.clinics) && res.data.clinics.length > 0) {
          setClinics(res.data.clinics)
          setIsNearby(true)
          setPlace(res.label)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (clinics.length === 0) return null

  return (
    <section className="section-pad bg-surface-warm border-y border-border">
      <div className="max-canvas">
        {/* Heading owns its own line; the subtitle row carries the "View all"
            link beside it, so the link never crowds the headline on mobile. */}
        <div className="mb-8">
          <h2 className="font-serif text-h2-m md:text-h2 text-ink-primary">
            {isNearby ? (place ? `Clinics near ${place}` : 'Clinics near you') : 'Featured Clinics'}
          </h2>
          <div className="mt-1 flex items-center justify-between gap-4">
            <p className="text-overline uppercase tracking-widest font-semibold text-ink-secondary">
              {isNearby ? 'Based on your location' : 'Top aesthetic clinics'}
            </p>
            <Link
              href="/clinics"
              className="text-body-sm md:text-body-lg text-brand-accent font-semibold hover:underline flex items-center gap-1.5 flex-shrink-0"
            >
              View all clinics
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {clinics.map((c) => (
            <DirectoryClinicCard key={c.id} c={c} dist={isNearby ? c.distanceMiles ?? null : null} />
          ))}
        </div>
      </div>
    </section>
  )
}
