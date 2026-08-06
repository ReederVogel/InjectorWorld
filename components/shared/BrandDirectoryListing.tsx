'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ListingFilters } from './ListingFilters'
import { DirectoryClinicCard } from './DirectoryClinicCard'
import {
  DEFAULT_LISTING_FILTERS,
  applyListingFilters,
  serverFilterKey,
  toServerFilterParams,
  type ListingFilterValues,
} from './applyListingFilters'
import { sortClinicsByMerit } from '@/lib/merit'
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
  const [serverTotal, setServerTotal] = useState<number | undefined>(totalClinics)

  useEffect(() => {
    setDisplayedClinics(clinics)
    setCurrentPage(1)
    setLoadError(null)
    setServerTotal(totalClinics)
  }, [clinics, brandSlug, stateSlug, citySlug, totalClinics])

  const meritSortedClinics = useMemo(() => sortClinicsByMerit(displayedClinics), [displayedClinics])
  const filtered = useMemo(
    () => applyListingFilters(meritSortedClinics, listingFilters, 'clinic').items,
    [meritSortedClinics, listingFilters],
  )

  const showLoadMore = Boolean(
    brandSlug && serverTotal && displayedClinics.length < serverTotal,
  )

  async function fetchPage(nextPage: number, append: boolean) {
    if (!brandSlug) return
    setIsLoading(true)
    setLoadError(null)

    try {
      const params = new URLSearchParams({
        brandSlug,
        page: String(nextPage),
        limit: '24',
      })
      if (stateSlug) params.set('stateSlug', stateSlug)
      if (citySlug) params.set('citySlug', citySlug)
      // Brand / service / clinic type / rating are resolved server-side as of
      // 2026-08-07, so totalDocs is the real match count for the filters.
      toServerFilterParams(listingFilters).forEach((value, key) => params.set(key, value))

      const res = await fetch(`/api/brand-clinics?${params.toString()}`)
      if (!res.ok) throw new Error('Unable to load more clinics.')
      const data = await res.json() as { clinics?: DirectoryClinic[]; totalDocs?: number }
      const nextClinics = Array.isArray(data.clinics) ? data.clinics : []

      setDisplayedClinics((prev) => {
        if (!append) return nextClinics
        const seen = new Set(prev.map((clinic) => clinic.id))
        return [...prev, ...nextClinics.filter((clinic) => !seen.has(clinic.id))]
      })
      if (typeof data.totalDocs === 'number') setServerTotal(data.totalDocs)
      setCurrentPage(nextPage)
    } catch {
      setLoadError('Could not load more clinics. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleLoadMore() {
    if (isLoading) return
    await fetchPage(currentPage + 1, true)
  }

  // Re-query from page 1 when a server-handled filter changes. The ref holds
  // the last key actually fetched, so the server-rendered first page is not
  // re-requested on mount.
  const serverKey = serverFilterKey(listingFilters)
  const appliedServerKey = useRef(serverKey)
  useEffect(() => {
    if (appliedServerKey.current === serverKey) return
    appliedServerKey.current = serverKey
    void fetchPage(1, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey])

  return (
    <div className="md:flex md:items-start md:gap-6">
      <ListingFilters
        items={displayedClinics}
        mode="clinics"
        resultCount={filtered.length}
        totalCount={serverTotal ?? displayedClinics.length}
        onChange={setListingFilters}
        serviceOptions={serviceOptions}
        brandOptions={brandOptions}
        // Only the brand routes have a server endpoint to re-query.
        serverFiltered={Boolean(brandSlug)}
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
          <p className="mt-4 text-body-sm text-state-error" role="status">
            {loadError}
          </p>
        )}

        {showLoadMore && (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-control border border-border text-body-sm font-medium text-ink-primary hover:border-brand-accent hover:bg-surface transition disabled:opacity-50"
            >
              {isLoading ? 'Loading...' : `Load more clinics (${Math.max(0, (serverTotal ?? 0) - displayedClinics.length)} remaining)`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
