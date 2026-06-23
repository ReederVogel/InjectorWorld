'use client'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ProviderListItem } from '@/lib/provider-queries'
import { licenseClaim } from '@/lib/license'
import type { MapPin } from '@/components/ui/ListingMapInner'
import { CompareModal } from '@/components/ui/CompareModal'
import { QuickViewPanel } from '@/components/ui/QuickViewPanel'
import { useSaved } from '@/components/account/SavedItemsProvider'
import { GateSection, FREE_COUNT } from '@/components/ui/GateSection'

// Leaflet is client-only
const ListingMapInner = dynamic(
  () => import('@/components/ui/ListingMapInner').then((m) => m.ListingMapInner),
  {
    ssr: false,
    loading: () => (
      <div className="w-full rounded-2xl bg-surface border border-border flex items-center justify-center text-ink-tertiary text-body-sm" style={{ height: 500 }}>
        Loading map…
      </div>
    ),
  },
)

// ─── Utility ────────────────────────────────────────────────────────────────

const CREDENTIAL_LABELS: Record<string, string> = {
  MD: 'MD / DO', DO: 'MD / DO', NP: 'NP / PA', PA: 'NP / PA', RN: 'RN', DDS: 'DDS',
}
const CREDENTIAL_GROUPS = ['All', 'MD / DO', 'NP / PA', 'RN']
const SORT_OPTS = ['Best rated', 'Most reviewed', 'Price: low to high', 'Distance'] as const
type SortOpt = typeof SORT_OPTS[number]

// How many provider cards to render before the "Load more" button.
// Map pins still cover the full filtered set; only the card grid paginates.
const PAGE_SIZE = 24

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

function coverGradient(treatments: string[]) {
  const t = (treatments[0] || '').toLowerCase()
  if (/botox|dysport|xeomin|jeuveau|daxxify/.test(t)) {
    return { background: 'linear-gradient(135deg, #0B1B34 0%, #1a3456 55%, #3FA68A 100%)' }
  }
  if (/filler|sculptra|kybella|lip|cheek|tear/.test(t)) {
    return { background: 'linear-gradient(135deg, #0B1B34 0%, #213d6b 55%, #4a7ea5 100%)' }
  }
  if (/microneedl|prp|thread|peel/.test(t)) {
    return { background: 'linear-gradient(135deg, #1a2d48 0%, #2a4a3e 55%, #3FA68A 100%)' }
  }
  return { background: 'linear-gradient(135deg, #0B1B34 0%, #1e3a58 55%, #3FA68A 100%)' }
}

function availabilityInfo(p: ProviderListItem) {
  if (!p.acceptsNewPatients) return { dot: 'bg-ink-tertiary', label: 'Waitlist' }
  if ((p.aggregateRatingCount ?? 0) >= 350) return { dot: 'bg-yellow-400', label: 'In demand' }
  return { dot: 'bg-brand-accent', label: 'Available' }
}

// ─── Main component ──────────────────────────────────────────────────────────

export function ProvidersGrid({ providers }: { providers: ProviderListItem[] }) {
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const [activeCredential, setActiveCredential] = useState('All')
  const [activeCity, setActiveCity] = useState('All')
  const [sortBy, setSortBy] = useState<SortOpt>('Best rated')
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null)
  const [locLoading, setLocLoading] = useState(false)
  const { savedProviders, isSaved, toggle, loggedIn, ready } = useSaved()
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [showCompareModal, setShowCompareModal] = useState(false)
  const [quickViewId, setQuickViewId] = useState<string | null>(null)
  const [activeMapPin, setActiveMapPin] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const cardRefs = useRef<Record<string, HTMLElement | null>>({})

  // Reset the visible window whenever the result set changes (filter/sort/location).
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [activeCredential, activeCity, sortBy, userLoc])

  const toggleCompare = useCallback((id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 3) return prev
      return [...prev, id]
    })
  }, [])

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

  const cities = ['All', ...Array.from(new Set(providers.map((p) => p.clinic.city))).sort()]

  // Filter
  const filtered = providers.filter((p) => {
    const credGroup = CREDENTIAL_LABELS[p.credentials] || p.credentials
    const credOk = activeCredential === 'All' || credGroup === activeCredential
    const cityOk = activeCity === 'All' || p.clinic.city === activeCity
    return credOk && cityOk
  })

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'Best rated') return (b.aggregateRating ?? 0) - (a.aggregateRating ?? 0)
    if (sortBy === 'Most reviewed') return (b.aggregateRatingCount ?? 0) - (a.aggregateRatingCount ?? 0)
    if (sortBy === 'Price: low to high') return (a.startingPrice ?? 9999) - (b.startingPrice ?? 9999)
    if (sortBy === 'Distance' && userLoc) {
      const da = haversine(userLoc.lat, userLoc.lng, a.clinic.latitude, a.clinic.longitude)
      const db = haversine(userLoc.lat, userLoc.lng, b.clinic.latitude, b.clinic.longitude)
      return da - db
    }
    return 0
  })

  // Map pins
  const mapPins: MapPin[] = sorted.map((p) => ({
    id: p.id,
    lat: p.clinic.latitude,
    lng: p.clinic.longitude,
    title: p.fullName,
    subtitle: p.clinic.name,
    meta: `${p.clinic.neighborhood || p.clinic.city}, ${p.clinic.state}`,
    href: `/injectors/${p.clinic.stateSlug}/${p.clinic.citySlug}/${p.slug}`,
    rating: p.aggregateRating,
    price: p.startingPrice,
  }))

  // When map pin clicked, scroll to card in list
  const onPinClick = useCallback((id: string) => {
    setActiveMapPin(id)
    const el = cardRefs.current[id]
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  const compareProviders = compareIds
    .map((id) => providers.find((p) => p.id === id))
    .filter(Boolean) as ProviderListItem[]

  const quickViewProvider = quickViewId ? providers.find((p) => p.id === quickViewId) : null

  return (
    <div>
      {/* ── Filter bar ── */}
      <div className="flex flex-wrap gap-x-5 gap-y-3 items-center mb-5 pb-5 border-b border-border">
        {/* Credential filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-caption text-ink-tertiary uppercase tracking-wider flex-shrink-0">Credential</span>
          {CREDENTIAL_GROUPS.map((g) => (
            <FilterPill key={g} active={activeCredential === g} onClick={() => setActiveCredential(g)}>{g}</FilterPill>
          ))}
        </div>

        <div className="hidden md:block w-px h-5 bg-border" />

        {/* City filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-caption text-ink-tertiary uppercase tracking-wider flex-shrink-0">City</span>
          {cities.map((c) => (
            <FilterPill key={c} active={activeCity === c} onClick={() => setActiveCity(c)}>{c}</FilterPill>
          ))}
        </div>

        {/* Spacer */}
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
          <span className="text-caption text-ink-tertiary uppercase tracking-wider flex-shrink-0">Sort</span>
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

      {/* ── Count + saved shortlist indicator ── */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-body-sm text-ink-tertiary">
          {sorted.length} {sorted.length === 1 ? 'injector' : 'injectors'}
          {userLoc && sortBy === 'Distance' ? ', sorted by distance' : ''}
        </p>
        {savedProviders.size > 0 && (
          <button
            onClick={() => {
              setActiveCity('All')
              setActiveCredential('All')
            }}
            className="flex items-center gap-1.5 text-body-sm text-brand-accent hover:underline"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
            </svg>
            {savedProviders.size} saved
          </button>
        )}
      </div>

      {/* ── Map view ── */}
      {viewMode === 'map' && (
        <div className="mb-8">
          <ListingMapInner
            pins={mapPins}
            activePinId={activeMapPin}
            onPinClick={onPinClick}
            height={500}
          />
          <p className="text-caption text-ink-tertiary mt-2 text-center">Click a pin to highlight the provider below.</p>
        </div>
      )}

      {/* ── List view ── */}
      {sorted.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-body text-ink-secondary">No injectors match your filters.</p>
          <button
            className="mt-4 text-brand-accent text-body-sm underline"
            onClick={() => { setActiveCredential('All'); setActiveCity('All') }}
          >
            Clear filters
          </button>
        </div>
      ) : (() => {
        const locked = ready && !loggedIn && sorted.length > FREE_COUNT
        return (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
              {sorted.slice(0, locked ? FREE_COUNT : visibleCount).map((p) => (
                <ProviderCard
                  key={p.id}
                  p={p}
                  isSaved={isSaved('provider', p.id)}
                  isCompared={compareIds.includes(p.id)}
                  canCompare={compareIds.length < 3 || compareIds.includes(p.id)}
                  isHighlighted={activeMapPin === p.id}
                  userLoc={userLoc}
                  onSave={() => toggle('provider', p.id)}
                  onCompare={() => toggleCompare(p.id)}
                  onQuickView={() => setQuickViewId(p.id)}
                  ref={(el) => { cardRefs.current[p.id] = el }}
                />
              ))}
            </div>

            <GateSection
              locked={locked}
              total={sorted.length}
              label="injectors"
              previewItems={sorted.slice(FREE_COUNT, FREE_COUNT + 3).map((p) => (
                <ProviderCard
                  key={p.id}
                  p={p}
                  isSaved={isSaved('provider', p.id)}
                  isCompared={false}
                  canCompare={false}
                  isHighlighted={false}
                  userLoc={null}
                  onSave={() => {}}
                  onCompare={() => {}}
                  onQuickView={() => {}}
                  ref={null}
                />
              ))}
            />

            {!locked && visibleCount < sorted.length && (
              <div className="mt-10 flex flex-col items-center gap-3">
                <p className="text-body-sm text-ink-tertiary">
                  Showing {Math.min(visibleCount, sorted.length)} of {sorted.length}
                </p>
                <button
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  className="px-6 py-3 rounded-pill border border-border bg-surface-canvas text-body-sm font-semibold text-ink-primary hover:border-brand-accent hover:bg-surface transition"
                >
                  Load more injectors
                </button>
              </div>
            )}
          </>
        )
      })()}

      {/* ── Comparison tray ── */}
      {compareIds.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface-canvas border-t border-border shadow-lg px-4 py-3">
          <div className="max-canvas flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-1 flex-wrap">
              {compareProviders.map((p) => (
                <div key={p.id} className="flex items-center gap-2 bg-surface border border-border rounded-pill pl-1.5 pr-3 py-1">
                  <div className="relative w-6 h-6 rounded-full overflow-hidden bg-surface-canvas flex-shrink-0">
                    {p.profilePhotoUrl && (
                      <Image src={p.profilePhotoUrl} alt={p.fullName} fill sizes="24px" className="object-cover" />
                    )}
                  </div>
                  <span className="text-body-sm font-medium text-ink-primary truncate max-w-[120px]">{p.fullName.split(' ')[0]}</span>
                  <button
                    onClick={() => toggleCompare(p.id)}
                    className="text-ink-tertiary hover:text-ink-primary transition"
                    aria-label={`Remove ${p.fullName}`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
              {compareIds.length < 3 && (
                <span className="text-body-sm text-ink-tertiary">
                  Add {3 - compareIds.length} more to compare
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCompareIds([])}
                className="px-4 py-2 rounded-pill border border-border text-body-sm text-ink-secondary hover:bg-surface transition"
              >
                Clear
              </button>
              <button
                onClick={() => setShowCompareModal(true)}
                disabled={compareIds.length < 2}
                className="px-5 py-2 rounded-pill bg-brand-primary text-surface-canvas text-body-sm font-semibold hover:opacity-90 transition disabled:opacity-40"
              >
                Compare {compareIds.length}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {showCompareModal && compareProviders.length >= 2 && (
        <CompareModal providers={compareProviders} onClose={() => setShowCompareModal(false)} />
      )}
      {quickViewProvider && (
        <QuickViewPanel provider={quickViewProvider} onClose={() => setQuickViewId(null)} />
      )}
    </div>
  )
}

// ─── Filter pill ─────────────────────────────────────────────────────────────

function FilterPill({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-pill text-body-sm font-medium border transition ${
        active
          ? 'bg-brand-primary text-surface-canvas border-brand-primary'
          : 'bg-surface-canvas text-ink-secondary border-border hover:border-brand-accent hover:text-ink-primary'
      }`}
    >
      {children}
    </button>
  )
}

// ─── Provider card ───────────────────────────────────────────────────────────

import React from 'react'

const ProviderCard = React.forwardRef<
  HTMLElement,
  {
    p: ProviderListItem
    isSaved: boolean
    isCompared: boolean
    canCompare: boolean
    isHighlighted: boolean
    userLoc: { lat: number; lng: number } | null
    onSave: () => void
    onCompare: () => void
    onQuickView: () => void
  }
>(function ProviderCard({ p, isSaved, isCompared, canCompare, isHighlighted, userLoc, onSave, onCompare, onQuickView }, ref) {
  const stars = Math.round(p.aggregateRating || 0)
  const avail = availabilityInfo(p)
  const dist = userLoc
    ? haversine(userLoc.lat, userLoc.lng, p.clinic.latitude, p.clinic.longitude)
    : null

  return (
    <article
      ref={ref}
      className={`group card-premium bg-surface-canvas rounded-2xl overflow-hidden flex flex-col border-2 transition-all duration-200 ${
        isHighlighted ? 'border-brand-accent shadow-hover scale-[1.01]' : 'border-border'
      }`}
    >
      {/* Cover photo */}
      <div className="relative h-[175px] bg-surface overflow-hidden flex-shrink-0">
        {p.clinic.photoUrl ? (
          <Image
            src={p.clinic.photoUrl}
            alt={p.clinic.name}
            fill
            sizes="(min-width:1024px) 33vw, (min-width:768px) 50vw, 100vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full" style={coverGradient(p.treatments)} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />

        {/* Top-left: Top pick */}
        {p.editorsPick && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 bg-brand-accent text-white text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-pill uppercase shadow">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" /></svg>
            Top pick
          </span>
        )}

        {/* Top-right: Save + Compare */}
        <div className="absolute top-3 right-3 flex gap-1.5">
          <button
            onClick={(e) => { e.preventDefault(); onSave() }}
            className={`w-8 h-8 rounded-pill flex items-center justify-center shadow transition ${
              isSaved ? 'bg-brand-accent text-white' : 'bg-white/90 text-ink-secondary hover:bg-white'
            }`}
            title={isSaved ? 'Remove from saved' : 'Save injector'}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.preventDefault(); onCompare() }}
            disabled={!canCompare && !isCompared}
            className={`w-8 h-8 rounded-pill flex items-center justify-center shadow transition ${
              isCompared ? 'bg-brand-primary text-surface-canvas' : 'bg-white/90 text-ink-secondary hover:bg-white disabled:opacity-40'
            }`}
            title={isCompared ? 'Remove from comparison' : 'Add to comparison'}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          </button>
        </div>

        {/* Availability dot bottom-left */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${avail.dot} flex-shrink-0`} />
          <span className="text-[10px] font-semibold text-white drop-shadow">{avail.label}</span>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col flex-1">
        {/* Avatar + identity */}
        <div className="flex items-start gap-3 mb-3 -mt-9">
          <div className="relative w-14 h-14 rounded-pill overflow-hidden bg-surface flex-shrink-0 border-4 border-surface-canvas shadow-md">
            {p.profilePhotoUrl && (
              <Image src={p.profilePhotoUrl} alt={p.fullName} fill sizes="56px" className="object-cover" />
            )}
          </div>
          <div className="pt-9 flex-1 min-w-0">
            <div className="font-semibold text-body text-ink-primary leading-tight truncate">{p.fullName}</div>
            <div className="text-caption text-ink-secondary mt-0.5 line-clamp-1">{p.title}</div>
          </div>
        </div>

        {/* License */}
        <div className="flex items-center gap-2 mb-2.5 text-caption text-ink-secondary">
          <span className="inline-flex w-4 h-4 rounded-full bg-brand-accent-soft items-center justify-center flex-shrink-0">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--brand-accent))" strokeWidth="3.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <span className="truncate">
            {licenseClaim(p.licenseVerificationUrl, p.licenseStatus)} &middot; {p.licenseStateCode} #{p.licenseNumber}
            {p.yearsExperience ? ` · ${p.yearsExperience} yrs` : ''}
          </span>
        </div>

        {/* Rating */}
        {p.aggregateRating ? (
          <div className="flex items-center gap-2 mb-3">
            <span className="star-row text-[13px]">{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
            <span className="text-body-sm text-ink-secondary">
              {p.aggregateRating.toFixed(1)} ({p.aggregateRatingCount?.toLocaleString()})
            </span>
          </div>
        ) : null}

        {/* Treatments */}
        <div className="flex flex-wrap gap-1.5 mb-4 flex-1">
          {p.treatments.slice(0, 3).map((t) => (
            <span key={t} className="text-[11px] px-2.5 py-1 rounded-pill bg-brand-accent-soft text-brand-primary font-medium">{t}</span>
          ))}
          {p.treatments.length > 3 && (
            <span className="text-[11px] px-2.5 py-1 rounded-pill bg-surface text-ink-tertiary font-medium">
              +{p.treatments.length - 3}
            </span>
          )}
        </div>

        {/* Price + location + distance */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-border-subtle text-body-sm">
          {p.startingPrice ? (
            <div><span className="text-ink-secondary">from </span><span className="font-semibold text-ink-primary">${p.startingPrice}</span></div>
          ) : (
            <span className="text-ink-tertiary">On request</span>
          )}
          <div className="text-ink-tertiary text-right">
            {dist !== null ? (
              <span className="font-medium text-ink-secondary">{dist.toFixed(1)} mi away</span>
            ) : (
              <span>{p.clinic.neighborhood || p.clinic.city}, {p.clinic.state}</span>
            )}
          </div>
        </div>

        {/* CTAs */}
        <div className="flex gap-2 mt-auto">
          <Link
            href={`/injectors/${p.clinic.stateSlug}/${p.clinic.citySlug}/${p.slug}#book`}
            className="flex-1 bg-brand-primary text-surface-canvas rounded-pill py-2.5 text-body-sm font-medium text-center hover:opacity-90 transition"
          >
            Book consult
          </Link>
          <button
            onClick={onQuickView}
            className="px-3.5 border border-border rounded-pill py-2.5 text-body-sm font-medium text-ink-secondary hover:bg-surface hover:border-brand-accent transition"
            title="Quick view"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          <Link
            href={`/injectors/${p.clinic.stateSlug}/${p.clinic.citySlug}/${p.slug}`}
            className="flex-1 border border-border rounded-pill py-2.5 text-body-sm font-medium text-center text-ink-primary hover:bg-surface hover:border-brand-accent transition"
          >
            Profile
          </Link>
        </div>
      </div>
    </article>
  )
})
