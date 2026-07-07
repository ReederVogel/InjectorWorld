'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DirectoryClinicCard } from '@/components/shared/DirectoryClinicCard'
import type { TopClinicRow } from '@/lib/home-queries'

type ClinicCardData = TopClinicRow & { distanceMiles?: number }

export function FeaturedClinicsSection({ fallback }: { fallback: TopClinicRow[] }) {
  const [clinics, setClinics] = useState<ClinicCardData[]>(fallback)
  const [isNearby, setIsNearby] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/geo/ip')
      .then((r) => r.json())
      .then((geo) => {
        if (cancelled || geo.lat == null || geo.lng == null) return null
        return fetch(`/api/home/nearby-clinics?lat=${geo.lat}&lng=${geo.lng}`).then((r) => r.json())
      })
      .then((data) => {
        if (cancelled || !data) return
        if (Array.isArray(data.clinics) && data.clinics.length > 0) {
          setClinics(data.clinics)
          setIsNearby(true)
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
        <div className="flex items-baseline justify-between mb-8">
          <div>
            <h2 className="font-serif text-h2 text-ink-primary mb-1">
              {isNearby ? 'Clinics near you' : 'Featured Clinics'}
            </h2>
            <p className="text-overline uppercase tracking-widest font-semibold text-brand-accent">
              {isNearby ? 'Near your location' : 'Top aesthetic clinics'}
            </p>
          </div>
          <Link
            href="/clinics"
            className="text-body-sm text-brand-accent font-medium hover:underline flex items-center gap-1 flex-shrink-0"
          >
            View all clinics
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
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
