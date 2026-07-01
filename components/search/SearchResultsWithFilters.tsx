'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ListingFilters } from '@/components/shared/ListingFilters'
import { ProviderClinicResults } from '@/components/shared/ProviderClinicResults'
import { LocationFilterBar } from '@/components/shared/LocationFilterBar'
import {
  applyListingFilters,
  DEFAULT_LISTING_FILTERS,
  type ListingFilterValues,
} from '@/components/shared/applyListingFilters'
import type { DirectoryProvider, DirectoryClinic, StateFilterOption } from '@/lib/location-queries'

/**
 * /search results + the Brand/Service filter sidebar (same ListingFilters
 * component the FIND-path state/city hubs use — see StateHubPage.tsx). Search
 * is location-first like the FIND path, so both filters are shown (per the
 * locked sidebar rule in CLAUDE.md), unlike the SERVICES/BRAND paths which
 * only show the one that isn't already pre-fixed by the URL.
 *
 * `stateOptions` is only ever non-empty when the user hasn't typed a location
 * themselves (the page decides this by checking the raw `location` param,
 * not `state`/`city` -- see app/(frontend)/search/page.tsx). Picking a
 * state/city here re-navigates with `state`/`city` params (kept separate
 * from `location` on purpose): if they shared the same param, selecting a
 * state made the code think "the user typed a location" and hid the very
 * bar that just set it -- a self-defeating loop that was the actual bug.
 */
export function SearchResultsWithFilters({
  providers,
  clinics,
  brandOptions,
  serviceOptions,
  stateOptions,
  query,
  initialState,
  initialCity,
}: {
  providers: DirectoryProvider[]
  clinics: DirectoryClinic[]
  brandOptions: { id: string; name: string }[]
  serviceOptions: { id: string; name: string }[]
  stateOptions: StateFilterOption[]
  query: string
  initialState: string
  initialCity: string
}) {
  const router = useRouter()
  const [filters, setFilters] = useState<ListingFilterValues>(DEFAULT_LISTING_FILTERS)
  // Seeded from the URL (not always '') so the dropdown reflects the current
  // selection after navigation, refresh, or browser back/forward -- not just
  // whatever was clicked in this particular client session.
  const [selectedState, setSelectedState] = useState(initialState)
  const [selectedCity, setSelectedCity] = useState(initialCity)

  function handleLocationChange(stateCode: string, city: string) {
    setSelectedState(stateCode)
    setSelectedCity(city)
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (stateCode) params.set('state', stateCode)
    if (city) params.set('city', city)
    router.push(`/search?${params.toString()}`)
  }

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
        {stateOptions.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-3 items-center mb-5 pb-5 border-b border-border">
            <LocationFilterBar
              stateOptions={stateOptions}
              selectedState={selectedState}
              selectedCity={selectedCity}
              onLocationChange={handleLocationChange}
            />
          </div>
        )}
        <ProviderClinicResults providers={filteredProviders} clinics={filteredClinics} />
      </div>
    </div>
  )
}
