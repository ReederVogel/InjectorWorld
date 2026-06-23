'use client'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type { ClinicListItem } from '@/lib/clinic-queries'
import type { MapPin } from '@/components/ui/ListingMapInner'
import { useSaved } from '@/components/account/SavedItemsProvider'
import { GateSection, FREE_COUNT } from '@/components/ui/GateSection'

const ListingMapInner = dynamic(
  () => import('@/components/ui/ListingMapInner').then((m) => m.ListingMapInner),
  {
    ssr: false,
    loading: () => (
      <div className="w-full rounded-2xl bg-surface border border-border flex items-center justify-center text-ink-tertiary text-body-sm" style={{ height: 480 }}>
        Loading map…
      </div>
    ),
  },
)

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 3959
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const SORT_OPTS = ['Best rated', 'Distance'] as const
type SortOpt = typeof SORT_OPTS[number]

export function ClinicsGrid({ clinics }: { clinics: ClinicListItem[] }) {
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const [activeState, setActiveState] = useState('All')
  const [sortBy, setSortBy] = useState<SortOpt>('Best rated')
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null)
  const [locLoading, setLocLoading] = useState(false)
  const { savedClinics, isSaved, toggle, loggedIn, ready } = useSaved()
  const [activeMapPin, setActiveMapPin] = useState<string | null>(null)

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) return
    setLocLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setSortBy('Distance')
        setLocLoading(false)
      },
      () => setLocLoading(false),
    )
  }, [])

  const states = ['All', ...Array.from(new Set(clinics.map((c) => c.state))).sort()]

  const filtered = clinics.filter((c) => activeState === 'All' || c.state === activeState)

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'Best rated') return (b.aggregateRating ?? 0) - (a.aggregateRating ?? 0)
    if (sortBy === 'Distance' && userLoc) {
      return haversine(userLoc.lat, userLoc.lng, a.latitude, a.longitude) -
             haversine(userLoc.lat, userLoc.lng, b.latitude, b.longitude)
    }
    return 0
  })

  const mapPins: MapPin[] = sorted.map((c) => ({
    id: c.id,
    lat: c.latitude,
    lng: c.longitude,
    title: c.clinicName,
    subtitle: c.neighborhood ? `${c.neighborhood}, ${c.city}` : c.city,
    meta: c.state,
    href: `/clinics/${c.stateSlug}/${c.citySlug}/${c.slug}`,
    rating: c.aggregateRating,
  }))

  const distOf = (c: ClinicListItem) =>
    userLoc ? haversine(userLoc.lat, userLoc.lng, c.latitude, c.longitude) : null

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-wrap gap-x-5 gap-y-3 items-center mb-5 pb-5 border-b border-border">
        {/* State filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-caption text-ink-tertiary uppercase tracking-wider flex-shrink-0">State</span>
          {states.map((s) => (
            <button
              key={s}
              onClick={() => setActiveState(s)}
              className={`px-3.5 py-1.5 rounded-pill text-body-sm font-medium border transition ${
                activeState === s
                  ? 'bg-brand-primary text-surface-canvas border-brand-primary'
                  : 'bg-surface-canvas text-ink-secondary border-border hover:border-brand-accent hover:text-ink-primary'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex-1 hidden md:block" />

        {/* Near me */}
        <button
          onClick={requestLocation}
          disabled={locLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill border border-border text-body-sm text-ink-secondary hover:border-brand-accent hover:text-ink-primary transition disabled:opacity-50"
        >
          {locLoading ? (
            <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 12a9 9 0 11-6.219-8.56" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M2 12h4M18 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
            </svg>
          )}
          {userLoc ? 'Near me on' : 'Near me'}
        </button>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <span className="text-caption text-ink-tertiary uppercase tracking-wider">Sort</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOpt)}
            className="text-body-sm border border-border rounded-pill px-3 py-1.5 bg-surface-canvas text-ink-primary focus:outline-none focus:border-brand-accent"
          >
            {SORT_OPTS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>

        {/* View toggle */}
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
          {sorted.length} {sorted.length === 1 ? 'clinic' : 'clinics'}
          {userLoc && sortBy === 'Distance' ? ', sorted by distance' : ''}
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
          <ListingMapInner
            pins={mapPins}
            activePinId={activeMapPin}
            onPinClick={setActiveMapPin}
            height={480}
          />
          <p className="text-caption text-ink-tertiary mt-2 text-center">Click a pin to see the clinic below.</p>
        </div>
      )}

      {/* Grid */}
      {sorted.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-body text-ink-secondary">No clinics match your filter.</p>
          <button className="mt-4 text-brand-accent text-body-sm underline" onClick={() => setActiveState('All')}>
            Clear filter
          </button>
        </div>
      ) : (() => {
        const locked = ready && !loggedIn && sorted.length > FREE_COUNT
        return (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
              {sorted.slice(0, locked ? FREE_COUNT : sorted.length).map((c) => (
                <ClinicCard
                  key={c.id}
                  c={c}
                  isSaved={isSaved('clinic', c.id)}
                  isHighlighted={activeMapPin === c.id}
                  dist={distOf(c)}
                  onSave={() => toggle('clinic', c.id)}
                />
              ))}
            </div>
            <GateSection
              locked={locked}
              total={sorted.length}
              label="clinics"
              previewItems={sorted.slice(FREE_COUNT, FREE_COUNT + 3).map((c) => (
                <ClinicCard
                  key={c.id}
                  c={c}
                  isSaved={isSaved('clinic', c.id)}
                  isHighlighted={false}
                  dist={distOf(c)}
                  onSave={() => toggle('clinic', c.id)}
                />
              ))}
            />
          </>
        )
      })()}
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
            <span className="star-row text-[13px]">{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
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
