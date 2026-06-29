'use client'

import { useEffect, useMemo, useState } from 'react'
import { DirectoryClinicCard } from '@/components/shared/DirectoryClinicCard'
import { ListingFilters } from '@/components/shared/ListingFilters'
import {
  DEFAULT_LISTING_FILTERS,
  applyListingFilters,
  type ListingFilterValues,
} from '@/components/shared/applyListingFilters'
import type { DirectoryClinic } from '@/lib/location-queries'

const PAGE_SIZE = 12

export function TreatmentDirectory({
  clinics,
  treatmentName,
  brandOptions,
}: {
  clinics: DirectoryClinic[]
  treatmentName: string
  brandOptions?: Array<{ id: string; name: string; slug: string }>
}) {
  const [visibleClinics, setVisibleClinics] = useState(PAGE_SIZE)
  const [listingFilters, setListingFilters] = useState<ListingFilterValues>(DEFAULT_LISTING_FILTERS)

  const filteredClinics = useMemo(
    () => applyListingFilters(clinics, listingFilters, 'clinic').items,
    [clinics, listingFilters],
  )

  useEffect(() => {
    setVisibleClinics(PAGE_SIZE)
  }, [listingFilters])

  const shownClinics = filteredClinics.slice(0, visibleClinics)

  return (
    <div className="md:flex md:items-start md:gap-6">
      <ListingFilters
        items={clinics}
        mode="clinics"
        resultCount={filteredClinics.length}
        totalCount={clinics.length}
        onChange={setListingFilters}
        brandOptions={brandOptions?.map((b) => ({ id: String(b.id), name: b.name }))}
      />

      <div className="min-w-0 flex-1 pb-20 md:pb-0">
        {filteredClinics.length === 0 ? (
          <EmptyState treatmentName={treatmentName} />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {shownClinics.map((c) => (
                <DirectoryClinicCard key={c.id} c={c} />
              ))}
            </div>
            {visibleClinics < filteredClinics.length && (
              <LoadMore
                shown={shownClinics.length}
                total={filteredClinics.length}
                onMore={() => setVisibleClinics((v) => v + PAGE_SIZE)}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Load more ────────────────────────────────────────────────────────────────

function LoadMore({
  shown,
  total,
  onMore,
}: {
  shown: number
  total: number
  onMore: () => void
}) {
  return (
    <div className="mt-10 flex flex-col items-center gap-3">
      <p className="text-body-sm text-ink-tertiary">
        Showing {shown} of {total} clinics
      </p>
      <button
        onClick={onMore}
        className="px-6 py-3 rounded-pill border border-border bg-surface-canvas text-body-sm font-semibold text-ink-primary hover:border-brand-accent hover:bg-surface transition"
      >
        Load more clinics
      </button>
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
