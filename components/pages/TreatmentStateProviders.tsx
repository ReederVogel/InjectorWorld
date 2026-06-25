'use client'

import { useMemo, useState } from 'react'
import { DirectoryProviderCard } from '@/components/shared/DirectoryProviderCard'
import { ListingFilters } from '@/components/shared/ListingFilters'
import {
  DEFAULT_LISTING_FILTERS,
  applyListingFilters,
  type ListingFilterValues,
} from '@/components/shared/applyListingFilters'
import type { DirectoryProvider } from '@/lib/location-queries'

export function TreatmentStateProviders({
  providers,
  treatmentName,
  stateName,
}: {
  providers: DirectoryProvider[]
  treatmentName: string
  stateName: string
}) {
  const [listingFilters, setListingFilters] = useState<ListingFilterValues>(DEFAULT_LISTING_FILTERS)
  const filtered = useMemo(
    () => applyListingFilters(providers, listingFilters, 'provider').items,
    [providers, listingFilters],
  )

  return (
    <div className="md:flex md:items-start md:gap-6">
      <ListingFilters
        items={providers}
        mode="providers"
        resultCount={filtered.length}
        totalCount={providers.length}
        onChange={setListingFilters}
      />

      <div className="min-w-0 flex-1 pb-20 md:pb-0">
        <h2 className="font-serif text-h2 text-ink-primary mb-6">
          Top {treatmentName} injectors in {stateName}
        </h2>
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center">
            <p className="text-body text-ink-secondary">No injectors match your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p, i) => (
              <DirectoryProviderCard key={p.id} provider={p} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
