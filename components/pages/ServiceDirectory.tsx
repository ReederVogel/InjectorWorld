'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { DirectoryClinicCard } from '@/components/shared/DirectoryClinicCard'
import { ListingFilters } from '@/components/shared/ListingFilters'
import {
  DEFAULT_LISTING_FILTERS,
  applyListingFilters,
  serverFilterKey,
  toServerFilterParams,
  type ListingFilterValues,
} from '@/components/shared/applyListingFilters'
import { sortClinicsByMeritWithinBuckets } from '@/lib/merit'
import type { DirectoryClinic } from '@/lib/location-queries'

export function ServiceDirectory({
  clinics,
  serviceName,
  serviceSlug,
  stateSlug,
  totalClinics,
  brandOptions,
}: {
  clinics: DirectoryClinic[]
  serviceName: string
  serviceSlug: string
  /** When set, scopes the listing (and its server load-more) to one state. */
  stateSlug?: string
  totalClinics?: number
  brandOptions?: Array<{ id: string; name: string; slug: string }>
}) {
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
  }, [clinics, serviceSlug, stateSlug, totalClinics])

  // Distance band first, merit inside the band. With no visitor location every
  // clinic shares one band and this is identical to the plain merit sort.
  const meritSortedClinics = useMemo(
    () => sortClinicsByMeritWithinBuckets(displayedClinics),
    [displayedClinics],
  )
  const filteredClinics = useMemo(
    () => applyListingFilters(meritSortedClinics, listingFilters, 'clinic').items,
    [meritSortedClinics, listingFilters],
  )

  const showLoadMore = Boolean(serverTotal && displayedClinics.length < serverTotal)

  async function fetchPage(nextPage: number, append: boolean) {
    setIsLoading(true)
    setLoadError(null)

    try {
      const params = new URLSearchParams({ serviceSlug: serviceSlug, page: String(nextPage), limit: '24' })
      if (stateSlug) params.set('stateSlug', stateSlug)
      // Brand / service / clinic type / rating are resolved server-side as of
      // 2026-08-07, so totalDocs is the real match count for the filters.
      toServerFilterParams(listingFilters).forEach((value, key) => params.set(key, value))

      const res = await fetch(`/api/service-city-clinics?${params.toString()}`)
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
        resultCount={filteredClinics.length}
        totalCount={serverTotal ?? displayedClinics.length}
        onChange={setListingFilters}
        brandOptions={brandOptions?.map((b) => ({ id: String(b.id), name: b.name }))}
        serverFiltered
      />

      <div className="min-w-0 flex-1 pb-20 md:pb-0">
        {filteredClinics.length === 0 ? (
          <EmptyState serviceName={serviceName} />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {filteredClinics.map((c) => (
                <DirectoryClinicCard key={c.id} c={c} />
              ))}
            </div>
            <p className="mt-6 text-body-sm text-ink-tertiary text-center">
              Showing {filteredClinics.length} of {(totalClinics ?? filteredClinics.length).toLocaleString()} clinics
            </p>
            {loadError && (
              <p className="mt-4 text-body-sm text-state-error text-center" role="status">{loadError}</p>
            )}
            {showLoadMore && (
              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-control border border-border text-body-sm font-medium text-ink-primary hover:border-brand-accent hover:bg-surface transition disabled:opacity-50"
                >
                  {isLoading ? 'Loading...' : `Load more clinics (${Math.max(0, (totalClinics ?? 0) - displayedClinics.length)} remaining)`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ serviceName }: { serviceName: string }) {
  return (
    <div className="text-center py-20">
      <p className="text-body text-ink-secondary">
        No verified clinics offering {serviceName} yet.
      </p>
      <p className="text-body-sm text-ink-tertiary mt-2">
        Check back soon. We verify new clinics regularly.
      </p>
    </div>
  )
}
