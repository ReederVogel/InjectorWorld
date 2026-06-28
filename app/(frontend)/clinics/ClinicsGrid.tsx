'use client'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { ClinicListItem } from '@/lib/clinic-queries'
import type { MapPin } from '@/components/ui/ListingMapInner'
import { useSaved } from '@/components/account/SavedItemsProvider'
import { GateSection, FREE_COUNT } from '@/components/ui/GateSection'
import { LazyMapMount } from '@/components/shared/LazyMapMount'
import { ListingFilters } from '@/components/shared/ListingFilters'
import {
  DEFAULT_LISTING_FILTERS,
  applyListingFilters,
  type ListingFilterValues,
} from '@/components/shared/applyListingFilters'

const ListingMapInner = dynamic(
  () => import('@/components/ui/ListingMapInner').then((m) => m.ListingMapInner),
  {
    ssr: false,
    loading: () => (
      <div className="w-full rounded-2xl bg-surface border border-border flex items-center justify-center text-ink-tertiary text-body-sm" style={{ height: 480 }}>
        Loading map...
      </div>
    ),
  },
)

type FilterOption = { id: string; name: string }
type StateOption = { code: string; name: string; slug: string }

type Props = {
  initialClinics: ClinicListItem[]
  totalClinics: number
  stateOptions: StateOption[]
  serviceOptions: FilterOption[]
  brandOptions: FilterOption[]
}

export function ClinicsGrid({
  initialClinics,
  totalClinics,
  stateOptions,
  serviceOptions,
  brandOptions,
}: Props) {
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const [listingFilters, setListingFilters] = useState<ListingFilterValues>(DEFAULT_LISTING_FILTERS)
  const [allClinics, setAllClinics] = useState(initialClinics)
  const [currentTotal, setCurrentTotal] = useState(totalClinics)
  const [selectedState, setSelectedState] = useState('')
  const [selectedCity, setSelectedCity] = useState('')
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const { savedClinics, isSaved, toggle, loggedIn, ready } = useSaved()
  const [activeMapPin, setActiveMapPin] = useState<string | null>(null)

  const cityOptions = useMemo(() => {
    if (!selectedState) return []
    return Array.from(new Set(
      allClinics
        .filter((c) => c.state === selectedState)
        .map((c) => c.city)
        .filter(Boolean),
    )).sort()
  }, [allClinics, selectedState])

  const listingFiltered = useMemo(
    () => applyListingFilters(allClinics, listingFilters, 'clinic').items,
    [allClinics, listingFilters],
  )

  const hasMore = allClinics.length < currentTotal

  async function fetchClinics({
    stateCode,
    city,
    nextPage,
    append,
  }: {
    stateCode: string
    city: string
    nextPage: number
    append: boolean
  }) {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: '24',
      })
      if (stateCode) params.set('stateCode', stateCode)
      if (city) params.set('city', city)

      const res = await fetch(`/api/clinics-list?${params.toString()}`)
      if (!res.ok) throw new Error('Unable to load clinics.')

      const json = await res.json() as { clinics?: ClinicListItem[]; totalDocs?: number }
      const nextClinics = Array.isArray(json.clinics) ? json.clinics : []

      setAllClinics((prev) => append ? [...prev, ...nextClinics] : nextClinics)
      setCurrentTotal(Number(json.totalDocs ?? nextClinics.length))
      setPage(nextPage)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleStateChange(code: string) {
    setSelectedState(code)
    setSelectedCity('')
    setPage(1)
    await fetchClinics({ stateCode: code, city: '', nextPage: 1, append: false })
  }

  async function handleCityChange(city: string) {
    setSelectedCity(city)
    setPage(1)
    await fetchClinics({ stateCode: selectedState, city, nextPage: 1, append: false })
  }

  async function loadMore() {
    await fetchClinics({
      stateCode: selectedState,
      city: selectedCity,
      nextPage: page + 1,
      append: true,
    })
  }

  const mapPins: MapPin[] = listingFiltered.map((c) => ({
    id: c.id,
    lat: c.latitude,
    lng: c.longitude,
    title: c.clinicName,
    subtitle: c.neighborhood ? `${c.neighborhood}, ${c.city}` : c.city,
    meta: c.state,
    href: `/clinics/${c.stateSlug}/${c.citySlug}/${c.slug}`,
    rating: c.aggregateRating,
  }))

  return (
    <div className="md:flex md:items-start md:gap-6">
      <ListingFilters
        items={allClinics}
        mode="clinics"
        resultCount={listingFiltered.length}
        totalCount={allClinics.length}
        onChange={setListingFilters}
        serviceOptions={serviceOptions}
        brandOptions={brandOptions}
      />

      <div className="min-w-0 flex-1 pb-24 md:pb-0">
        {/* Filter bar - state/city + view toggle */}
        <div className="flex flex-wrap gap-x-4 gap-y-3 items-center mb-5 pb-5 border-b border-border">
          {/* State select */}
          <select
            value={selectedState}
            onChange={(e) => handleStateChange(e.target.value)}
            disabled={isLoading}
            className="text-body-sm border border-border rounded-pill px-3 py-1.5 bg-surface-canvas text-ink-primary focus:outline-none focus:border-brand-accent disabled:opacity-50"
          >
            <option value="">All states</option>
            {stateOptions.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>

          {/* City select - only when state selected */}
          {selectedState && (
            <select
              value={selectedCity}
              onChange={(e) => handleCityChange(e.target.value)}
              disabled={isLoading || cityOptions.length === 0}
              className="text-body-sm border border-border rounded-pill px-3 py-1.5 bg-surface-canvas text-ink-primary focus:outline-none focus:border-brand-accent disabled:opacity-50"
            >
              <option value="">All cities in {stateOptions.find((s) => s.code === selectedState)?.name}</option>
              {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}

          <div className="flex-1" />

          {/* List / Map toggle - unchanged */}
          <div className="flex rounded-pill border border-border overflow-hidden flex-shrink-0">
            {(['list', 'map'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-body-sm font-medium transition ${
                  viewMode === mode ? 'bg-brand-primary text-surface-canvas' : 'bg-surface-canvas text-ink-secondary hover:bg-surface'
                }`}
              >
                {mode === 'list' ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="3 11 22 2 13 21 11 13 3 11" />
                  </svg>
                )}
                {mode === 'list' ? 'List' : 'Map'}
              </button>
            ))}
          </div>
        </div>

        {/* Count + saved */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-body-sm text-ink-tertiary">
            {listingFiltered.length} {listingFiltered.length === 1 ? 'clinic' : 'clinics'}
          </p>
          {savedClinics.size > 0 && (
            <span className="flex items-center gap-1.5 text-body-sm text-brand-accent">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
              </svg>
              {savedClinics.size} saved
            </span>
          )}
        </div>

        {/* Map */}
        {viewMode === 'map' && (
          <div className="mb-8">
            <LazyMapMount
              placeholder={
                <div className="w-full rounded-2xl bg-surface border border-border flex items-center justify-center text-ink-tertiary text-body-sm" style={{ height: 480 }}>
                  Loading map...
                </div>
              }
            >
              <ListingMapInner
                pins={mapPins}
                activePinId={activeMapPin}
                onPinClick={setActiveMapPin}
                height={480}
              />
            </LazyMapMount>
            <p className="text-caption text-ink-tertiary mt-2 text-center">Click a pin to see the clinic below.</p>
          </div>
        )}

        {/* Grid */}
        {listingFiltered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-body text-ink-secondary">No clinics match your filter.</p>
            <p className="text-body-sm text-ink-tertiary mt-1">
              Looking for a specific city? <Link href="/states" className="text-brand-accent underline">Browse the full directory by state</Link>.
            </p>
            <button
              className="mt-4 text-brand-accent text-body-sm underline"
              onClick={() => handleStateChange('')}
            >
              Clear filters
            </button>
          </div>
        ) : (() => {
          const locked = ready && !loggedIn && listingFiltered.length > FREE_COUNT
          return (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
                {listingFiltered.slice(0, locked ? FREE_COUNT : listingFiltered.length).map((c) => (
                  <ClinicCard
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
                total={listingFiltered.length}
                label="clinics"
                previewItems={listingFiltered.slice(FREE_COUNT, FREE_COUNT + 3).map((c) => (
                  <ClinicCard
                    key={c.id}
                    c={c}
                    isSaved={isSaved('clinic', c.id)}
                    isHighlighted={false}
                    dist={null}
                    onSave={() => toggle('clinic', c.id)}
                  />
                ))}
              />
              {hasMore && !isLoading && (
                <div className="mt-8 text-center">
                  <button
                    onClick={loadMore}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-pill border border-border text-body-sm font-medium text-ink-primary hover:border-brand-accent hover:bg-surface transition"
                  >
                    Load more clinics ({currentTotal - allClinics.length} remaining)
                  </button>
                </div>
              )}
              {isLoading && (
                <div className="mt-8 text-center text-body-sm text-ink-tertiary">Loading...</div>
              )}
            </>
          )
        })()}
      </div>
    </div>
  )
}

function ClinicCard({
  c,
  isSaved,
  isHighlighted,
  dist,
  onSave,
}: {
  c: ClinicListItem
  isSaved: boolean
  isHighlighted: boolean
  dist: number | null
  onSave: () => void
}) {
  const stars = Math.round(c.aggregateRating || 0)
  return (
    <article
      className={`group card-premium bg-surface-canvas rounded-2xl overflow-hidden flex flex-col border-2 transition-all duration-200 ${
        isHighlighted ? 'border-brand-accent shadow-hover scale-[1.01]' : 'border-border'
      }`}
    >
      {/* Photo */}
      <div className="relative h-[200px] bg-surface overflow-hidden flex-shrink-0">
        {c.photoUrl ? (
          <Image
            src={c.photoUrl}
            alt={c.clinicName}
            fill
            sizes="(min-width:1024px) 33vw, (min-width:768px) 50vw, 100vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-surface to-brand-accent-soft" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />

        {/* Save button */}
        <button
          onClick={(e) => { e.preventDefault(); onSave() }}
          className={`absolute top-3 right-3 w-8 h-8 rounded-pill flex items-center justify-center shadow transition ${
            isSaved ? 'bg-brand-accent text-white' : 'bg-white/90 text-ink-secondary hover:bg-white'
          }`}
          title={isSaved ? 'Remove from saved' : 'Save clinic'}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
          </svg>
        </button>

        {/* Badges */}
        <div className="absolute bottom-3 left-3 flex gap-1.5">
          <span className="bg-white/90 text-ink-primary text-[10px] font-semibold px-2.5 py-1 rounded-pill">
            {c.serviceType}
          </span>
          {c.yearEstablished && (
            <span className="bg-white/90 text-ink-primary text-[10px] font-semibold px-2.5 py-1 rounded-pill">
              Est. {c.yearEstablished}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col flex-1">
        <h2 className="font-semibold text-body text-ink-primary mb-1 leading-tight">{c.clinicName}</h2>
        <p className="text-body-sm text-ink-secondary mb-2">
          {c.neighborhood ? `${c.neighborhood}, ` : ''}{c.city}, {c.state}
          {dist !== null && (
            <span className="ml-2 font-medium text-brand-accent">{dist.toFixed(1)} mi</span>
          )}
        </p>

        {c.tagline && (
          <p className="text-body-sm text-ink-secondary mb-3 line-clamp-2 italic">{c.tagline}</p>
        )}

        {c.aggregateRating ? (
          <div className="flex items-center gap-2 mb-3">
            <span className="star-row text-[13px]">{'â˜…'.repeat(stars)}{'â˜†'.repeat(5 - stars)}</span>
            <span className="text-body-sm text-ink-secondary">
              {c.aggregateRating.toFixed(1)} ({c.aggregateRatingCount?.toLocaleString()})
            </span>
          </div>
        ) : null}

        <div className="flex items-center gap-1.5 mb-4 text-caption text-ink-secondary flex-1">
          <span className="inline-flex w-4 h-4 rounded-full bg-brand-accent-soft items-center justify-center flex-shrink-0">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--brand-accent))" strokeWidth="3.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          Verified practice
        </div>

        <Link
          href={`/clinics/${c.stateSlug}/${c.citySlug}/${c.slug}`}
          className="mt-auto w-full bg-brand-primary text-surface-canvas rounded-pill py-2.5 text-body-sm font-medium text-center hover:opacity-90 transition"
        >
          View clinic
        </Link>
      </div>
    </article>
  )
}
