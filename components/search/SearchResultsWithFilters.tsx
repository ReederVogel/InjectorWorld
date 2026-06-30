'use client'

import { useMemo, useState } from 'react'
import { ListingFilters } from '@/components/shared/ListingFilters'
import { ProviderClinicResults } from '@/components/shared/ProviderClinicResults'
import {
  applyListingFilters,
  DEFAULT_LISTING_FILTERS,
  type ListingFilterValues,
} from '@/components/shared/applyListingFilters'
import type { DirectoryProvider, DirectoryClinic } from '@/lib/location-queries'

/**
 * /search results + the Brand/Service filter sidebar (same ListingFilters
 * component the FIND-path state/city hubs use — see StateHubPage.tsx). Search
 * is location-first like the FIND path, so both filters are shown (per the
 * locked sidebar rule in CLAUDE.md), unlike the SERVICES/BRAND paths which
 * only show the one that isn't already pre-fixed by the URL.
 */
export function SearchResultsWithFilters({
  providers,
  clinics,
  brandOptions,
  serviceOptions,
}: {
  providers: DirectoryProvider[]
  clinics: DirectoryClinic[]
  brandOptions: { id: string; name: string }[]
  serviceOptions: { id: string; name: string }[]
}) {
  const [filters, setFilters] = useState<ListingFilterValues>(DEFAULT_LISTING_FILTERS)

  const filteredProviders = useMemo(
    () => applyListingFilters(providers, filters, 'provider').items,
    [providers, filters],
  )
  const filteredClinics = useMemo(
    () => applyListingFilters(clinics, filters, 'clinic').items,
    [clinics, filters],
  )
  const allItems = useMemo(() => [...providers, ...clinics], [providers, clinics])
  const resultCount = filteredProviders.length + filteredClinics.length
  const totalCount = providers.length + clinics.length

  return (
    <div className="md:flex md:items-start md:gap-6">
      <ListingFilters
        items={allItems}
        mode="mixed"
        resultCount={resultCount}
        totalCount={totalCount}
        onChange={setFilters}
        brandOptions={brandOptions}
        serviceOptions={serviceOptions}
      />
      <div className="min-w-0 flex-1">
        <ProviderClinicResults providers={filteredProviders} clinics={filteredClinics} />
      </div>
    </div>
  )
}
