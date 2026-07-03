'use client'

import { useEffect, useMemo, useState } from 'react'
import { DirectoryClinicCard } from '@/components/shared/DirectoryClinicCard'
import { ListingFilters } from '@/components/shared/ListingFilters'
import {
  DEFAULT_LISTING_FILTERS,
  applyListingFilters,
  type ListingFilterValues,
} from '@/components/shared/applyListingFilters'
import { sortClinicsByMerit } from '@/lib/merit'
import type { DirectoryClinic } from '@/lib/location-queries'

export function TreatmentDirectory({
  clinics,
  treatmentName,
  treatmentSlug,
  stateSlug,
  totalClinics,
  brandOptions,
}: {
  clinics: DirectoryClinic[]
  treatmentName: string
  treatmentSlug: string
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

  useEffect(() => {
    setDisplayedClinics(clinics)
    setCurrentPage(1)
    setLoadError(null)
  }, [clinics, treatmentSlug, stateSlug])

  const meritSortedClinics = useMemo(() => sortClinicsByMerit(displayedClinics), [displayedClinics])
  const filteredClinics = useMemo(
    () => applyListingFilters(meritSortedClinics, listingFilters, 'clinic').items,
    [meritSortedClinics, listingFilters],
  )

  const showLoadMore = Boolean(totalClinics && displayedClinics.length < totalClinics)

  async function handleLoadMore() {
    if (isLoading) return
    setIsLoading(true)
    setLoadError(null)

    const nextPage = currentPage + 1
    try {
      const params = new URLSearchParams({ serviceSlug: treatmentSlug, page: String(nextPage), limit: '24' })
      if (stateSlug) params.set('stateSlug', stateSlug)
      const res = await fetch(`/api/service-city-clinics?${params.toString()}`)
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
        resultCount={filteredClinics.length}
        totalCount={totalClinics ?? displayedClinics.length}
        onChange={setListingFilters}
        brandOptions={brandOptions?.map((b) => ({ id: String(b.id), name: b.name }))}
      />

      <div className="min-w-0 flex-1 pb-20 md:pb-0">
        {filteredClinics.length === 0 ? (
          <EmptyState treatmentName={treatmentName} />
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
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-pill border border-border text-body-sm font-medium text-ink-primary hover:border-brand-accent hover:bg-surface transition disabled:opacity-50"
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

function EmptyState({ treatmentName }: { treatmentName: string }) {
  return (
    <div className="text-center py-20">
      <p className="text-body text-ink-secondary">
        No verified clinics offering {treatmentName} yet.
      </p>
      <p className="text-body-sm text-ink-tertiary mt-2">
        Check back soon. We verify new clinics regularly.
      </p>
    </div>
  )
}
