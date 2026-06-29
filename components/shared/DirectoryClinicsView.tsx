'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState, useMemo } from 'react'
import { DirectoryClinicCard } from './DirectoryClinicCard'
import { LazyMapMount } from './LazyMapMount'
import { ListingFilters } from './ListingFilters'
import type { DirectoryClinic } from '@/lib/location-queries'
import type { MapPin } from '@/components/ui/ListingMapInner'
import { useSaved } from '@/components/account/SavedItemsProvider'
import { GateSection, FREE_COUNT } from '@/components/ui/GateSection'
import { distinctNeighborhoods, matchesNeighborhood } from '@/lib/neighborhood-filter'
import {
  DEFAULT_LISTING_FILTERS,
  applyListingFilters,
  type ListingFilterValues,
} from './applyListingFilters'

const ListingMapInner = dynamic(
  () => import('@/components/ui/ListingMapInner').then((m) => m.ListingMapInner),
  {
    ssr: false,
    loading: () => (
      <div className="w-full rounded-2xl bg-surface border border-border flex items-center justify-center text-ink-tertiary text-body-sm" style={{ height: 420 }}>
        Loading map…
      </div>
    ),
  },
)

export function DirectoryClinicsView({
  clinics,
  totalClinics,
  loadMoreUrl,
}: {
  clinics: DirectoryClinic[]
  totalClinics?: number
  loadMoreUrl?: string
}) {
  const [displayedClinics, setDisplayedClinics] = useState(clinics)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const { isSaved, toggle, loggedIn, ready } = useSaved()
  const [activeMapPin, setActiveMapPin] = useState<string | null>(null)
  const [neighborhood, setNeighborhood] = useState('')
  const [listingFilters, setListingFilters] = useState<ListingFilterValues>(DEFAULT_LISTING_FILTERS)

  useEffect(() => {
    setDisplayedClinics(clinics)
    setPage(1)
    setLoadError(null)
  }, [clinics, loadMoreUrl])

  const neighborhoodOptions = useMemo(
    () => distinctNeighborhoods(displayedClinics.map((c) => c.neighborhood)),
    [displayedClinics],
  )
  const listingFiltered = useMemo(
    () => applyListingFilters(displayedClinics, listingFilters, 'clinic').items,
    [displayedClinics, listingFilters],
  )
  const shown = useMemo(
    () => listingFiltered.filter((c) => matchesNeighborhood(c.neighborhood, neighborhood)),
    [listingFiltered, neighborhood],
  )
  const locked = ready && !loggedIn && shown.length > FREE_COUNT
  const hasMore = Boolean(loadMoreUrl && totalClinics && displayedClinics.length < totalClinics)

  async function loadMore() {
    if (!loadMoreUrl || isLoading || !hasMore) return

    setIsLoading(true)
    setLoadError(null)

    const nextPage = page + 1
    const separator = loadMoreUrl.includes('?') ? '&' : '?'
    try {
      const res = await fetch(`${loadMoreUrl}${separator}page=${nextPage}&limit=24`)
      if (!res.ok) throw new Error('Unable to load more clinics.')

      const data = await res.json() as { clinics?: DirectoryClinic[] }
      const nextClinics = Array.isArray(data.clinics) ? data.clinics : []

      setDisplayedClinics((prev) => {
        const seen = new Set(prev.map((clinic) => clinic.id))
        return [...prev, ...nextClinics.filter((clinic) => !seen.has(clinic.id))]
      })
      setPage(nextPage)
    } catch {
      setLoadError('Could not load more clinics. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (displayedClinics.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-brand-accent-soft flex items-center justify-center mx-auto mb-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--brand-accent))" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
        <p className="text-body text-ink-secondary mb-1">No clinics listed in this area yet.</p>
        <p className="text-body-sm text-ink-tertiary">We are actively adding clinics. Check the Providers tab above.</p>
      </div>
    )
  }

  const mapPins: MapPin[] = shown.map((c) => ({
    id: c.id,
    lat: c.latitude,
    lng: c.longitude,
    title: c.clinicName,
    subtitle: c.neighborhood ? `${c.neighborhood}, ${c.city}` : c.city,
    meta: `${c.providerCount} ${c.providerCount === 1 ? 'provider' : 'providers'}`,
    href: `/clinics/${c.stateSlug}/${c.citySlug}/${c.slug}`,
    rating: c.aggregateRating,
  }))

  return (
    <div className="md:flex md:items-start md:gap-6">
      <ListingFilters
        items={displayedClinics}
        mode="clinics"
        resultCount={shown.length}
        totalCount={displayedClinics.length}
        onChange={setListingFilters}
      />

      <div className="min-w-0 flex-1 pb-20 md:pb-0">
      {/* Count + filters + view toggle */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <p className="text-body-sm text-ink-tertiary">
          {shown.length} {shown.length === 1 ? 'clinic' : 'clinics'}
          {shown.filter((c) => isSaved('clinic', c.id)).length > 0 && (
            <span className="ml-3 inline-flex items-center gap-1.5 text-brand-accent">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
              </svg>
              {shown.filter((c) => isSaved('clinic', c.id)).length} saved
            </span>
          )}
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          {neighborhoodOptions.length > 0 && (
            <select
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              className="px-3 py-2 rounded-pill border border-border text-body-sm text-ink-primary bg-surface-canvas focus:outline-none focus:border-brand-accent cursor-pointer"
              aria-label="Filter clinics by neighborhood"
            >
              <option value="">All neighborhoods</option>
              {neighborhoodOptions.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          )}

          <div className="flex rounded-pill border border-border overflow-hidden flex-shrink-0">
          {(['list', 'map'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={viewMode === mode}
              onClick={() => setViewMode(mode)}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-body-sm font-medium transition ${
                viewMode === mode ? 'bg-brand-primary text-surface-canvas' : 'bg-surface-canvas text-ink-secondary hover:bg-surface'
              }`}
            >
              {mode === 'list' ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                  <line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" />
                </svg>
              )}
              {mode === 'list' ? 'List' : 'Map'}
            </button>
          ))}
        </div>
      </div>
      </div>

      {/* Map */}
      {viewMode === 'map' && (
        <div className="mb-6">
          <LazyMapMount
            placeholder={
              <div className="w-full rounded-2xl bg-surface border border-border flex items-center justify-center text-ink-tertiary text-body-sm" style={{ height: 460 }}>
                Loading map...
              </div>
            }
          >
            <ListingMapInner
              pins={mapPins}
              activePinId={activeMapPin}
              onPinClick={setActiveMapPin}
              height={460}
            />
          </LazyMapMount>
          <p className="text-caption text-ink-tertiary mt-2 text-center">Click a pin to highlight the clinic below.</p>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-5">
        {shown.slice(0, locked ? FREE_COUNT : shown.length).map((c) => (
          <DirectoryClinicCard
            key={c.id}
            c={c}
            isSaved={isSaved('clinic', c.id)}
            isHighlighted={activeMapPin === c.id}
            dist={null}
            onSave={() => toggle('clinic', c.id)}
          />
        ))}
      </div>
      <GateSection
        locked={locked}
        total={shown.length}
        label="clinics"
        previewItems={shown.slice(FREE_COUNT, FREE_COUNT + 2).map((c) => (
          <DirectoryClinicCard
            key={c.id}
            c={c}
            isSaved={isSaved('clinic', c.id)}
            isHighlighted={false}
            dist={null}
            onSave={() => toggle('clinic', c.id)}
          />
        ))}
      />
      {loadError && (
        <p className="mt-4 text-body-sm text-red-700 text-center" role="status">
          {loadError}
        </p>
      )}
      {hasMore && (
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-pill border border-border text-body-sm font-medium text-ink-primary hover:border-brand-accent hover:bg-surface transition disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : `Load more clinics (${Math.max(0, (totalClinics ?? 0) - displayedClinics.length)} remaining)`}
          </button>
        </div>
      )}
      </div>
    </div>
  )
}
