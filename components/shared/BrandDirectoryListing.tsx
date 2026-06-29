'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { ListingFilters } from './ListingFilters'
import { DirectoryClinicCard } from './DirectoryClinicCard'
import {
  DEFAULT_LISTING_FILTERS,
  applyListingFilters,
  type ListingFilterValues,
} from './applyListingFilters'
import type { DirectoryClinic } from '@/lib/location-queries'

type FilterOption = { id: string; name: string }

type Props = {
  clinics: DirectoryClinic[]
  serviceOptions?: FilterOption[]
  brandOptions?: FilterOption[]
  emptyMessage?: string
  emptyLink?: { href: string; label: string }
  brandSlug?: string
  stateSlug?: string
  citySlug?: string
  totalClinics?: number
}

export function BrandDirectoryListing({
  clinics,
  serviceOptions,
  brandOptions,
  emptyMessage,
  emptyLink,
  brandSlug,
  stateSlug,
  citySlug,
  totalClinics,
}: Props) {
  const [displayedClinics, setDisplayedClinics] = useState<DirectoryClinic[]>(clinics)
  const [listingFilters, setListingFilters] = useState<ListingFilterValues>(DEFAULT_LISTING_FILTERS)
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    setDisplayedClinics(clinics)
    setCurrentPage(1)
    setLoadError(null)
  }, [clinics, brandSlug, stateSlug, citySlug])

  const filtered = useMemo(
    () => applyListingFilters(displayedClinics, listingFilters, 'clinic').items,
    [displayedClinics, listingFilters],
  )

  const showLoadMore = Boolean(
    brandSlug && totalClinics && displayedClinics.length < totalClinics,
  )

  async function handleLoadMore() {
    if (!brandSlug || isLoading) return
    setIsLoading(true)
    setLoadError(null)

    const nextPage = currentPage + 1
    try {
      const params = new URLSearchParams({
        brandSlug,
        page: String(nextPage),
        limit: '24',
      })
      if (stateSlug) params.set('stateSlug', stateSlug)
      if (citySlug) params.set('citySlug', citySlug)

      const res = await fetch(`/api/brand-clinics?${params.toString()}`)
      if (!res.ok) throw new Error('Unable to load more clinics.')
      const data = await res.json() as { clinics?: DirectoryClinic[] }
      const nextClinics = Array.isArray(data.clinics) ? data.clinics : []

      setDisplayedClinics((prev) => {
        const seen = new Set(prev.map((clinic) => clinic.id))
        return [...prev, ...nextClinics.filter((clinic) => !seen.has(clinic.id))]
      })
      setCurrentPage(nextPage)
    } catch {
      setLoadError('Could not load more clinics. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="md:flex md:items-start md:gap-6">
      <ListingFilters
        items={displayedClinics}
        mode="clinics"
        resultCount={filtered.length}
        totalCount={displayedClinics.length}
        onChange={setListingFilters}
        serviceOptions={serviceOptions}
        brandOptions={brandOptions}
      />

      <div className="min-w-0 flex-1">
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {filtered.map((c) => (
              <DirectoryClinicCard key={c.id} c={c} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-body text-ink-secondary mb-3">
              {emptyMessage ?? 'No clinics match the selected filters.'}
            </p>
            {emptyLink && (
              <Link href={emptyLink.href} className="text-brand-accent hover:underline text-body-sm">
                {emptyLink.label}
              </Link>
            )}
          </div>
        )}

        {loadError && (
          <p className="mt-4 text-body-sm text-red-700" role="status">
            {loadError}
          </p>
        )}

        {showLoadMore && (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={isLoading}
              className="inline-flex items-center justify-center rounded-pill bg-brand-primary px-6 py-3 text-body-sm font-semibold text-surface-canvas transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? 'Loading...' : `Load more clinics (${Math.max(0, (totalClinics ?? 0) - displayedClinics.length)} remaining)`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
