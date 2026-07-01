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
 * `stateOptions` is only ever non-empty when the search has no location text
 * (the page decides this) -- picking a state/city here just re-navigates to
 * this same /search URL with `location` set, same as typing it would.
 */
export function SearchResultsWithFilters({
  providers,
  clinics,
  brandOptions,
  serviceOptions,
  stateOptions,
  query,
}: {
  providers: DirectoryProvider[]
  clinics: DirectoryClinic[]
  brandOptions: { id: string; name: string }[]
  serviceOptions: { id: string; name: string }[]
  stateOptions: StateFilterOption[]
  query: string
}) {
  const router = useRouter()
  const [filters, setFilters] = useState<ListingFilterValues>(DEFAULT_LISTING_FILTERS)
  const [selectedState, setSelectedState] = useState('')
  const [selectedCity, setSelectedCity] = useState('')

  function handleLocationChange(stateCode: string, city: string) {
    setSelectedState(stateCode)
    setSelectedCity(city)
    const stateName = stateOptions.find((s) => s.code === stateCode)?.name ?? stateCode
    const location = city ? `${city}, ${stateName}` : stateName
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (location) params.set('location', location)
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
