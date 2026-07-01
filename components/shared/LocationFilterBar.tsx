'use client'

import { useEffect, useState } from 'react'
import type { StateFilterOption } from '@/lib/location-queries'

type CityOption = { name: string; slug: string; clinicCount: number }

/**
 * State + City dropdown filter, backed by real published-clinic counts (e.g.
 * "Texas (64)"), fetched from the shared lib/location-queries.ts source. Used
 * by both /clinics (ClinicsGrid.tsx) and /search (SearchResultsWithFilters.tsx)
 * so there is one filter, not two parallel implementations.
 *
 * Controlled: the caller owns `selectedState`/`selectedCity` and decides what
 * happens on change (client-side re-fetch on /clinics, URL navigation on
 * /search) -- this component only renders the dropdowns and fetches the city
 * list for whichever state is selected.
 */
export function LocationFilterBar({
  stateOptions,
  selectedState,
  selectedCity,
  onLocationChange,
  disabled = false,
}: {
  stateOptions: StateFilterOption[]
  selectedState: string
  selectedCity: string
  onLocationChange: (stateCode: string, city: string) => void
  disabled?: boolean
}) {
  const [cityOptions, setCityOptions] = useState<CityOption[]>([])
  const [loadingCities, setLoadingCities] = useState(false)

  useEffect(() => {
    if (!selectedState) {
      setCityOptions([])
      return
    }
    const ctrl = new AbortController()
    setLoadingCities(true)
    fetch(`/api/location-filter-options?state=${encodeURIComponent(selectedState)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => setCityOptions(Array.isArray(data.cities) ? data.cities : []))
      .catch(() => {})
      .finally(() => setLoadingCities(false))
    return () => ctrl.abort()
  }, [selectedState])

  const selectedStateName = stateOptions.find((s) => s.code === selectedState)?.name

  return (
    <>
      <select
        value={selectedState}
        onChange={(e) => onLocationChange(e.target.value, '')}
        disabled={disabled}
        className="text-body-sm border border-border rounded-pill px-3 py-1.5 bg-surface-canvas text-ink-primary focus:outline-none focus:border-brand-accent disabled:opacity-50"
      >
        <option value="">All states</option>
        {stateOptions.map((s) => (
          <option key={s.code} value={s.code}>
            {s.name} ({s.clinicCount})
          </option>
        ))}
      </select>

      {selectedState && (
        <select
          value={selectedCity}
          onChange={(e) => onLocationChange(selectedState, e.target.value)}
          disabled={disabled || loadingCities || cityOptions.length === 0}
          className="text-body-sm border border-border rounded-pill px-3 py-1.5 bg-surface-canvas text-ink-primary focus:outline-none focus:border-brand-accent disabled:opacity-50"
        >
          <option value="">All cities in {selectedStateName}</option>
          {cityOptions.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name} ({c.clinicCount})
            </option>
          ))}
        </select>
      )}
    </>
  )
}
