'use client'

import dynamic from 'next/dynamic'
import { useState, useMemo, useEffect } from 'react'
import { DirectoryProviderCard } from './DirectoryProviderCard'
import type { DirectoryProvider } from '@/lib/location-queries'

const DirectoryMap = dynamic(
  () => import('./DirectoryMap').then((m) => m.DirectoryMap),
  { ssr: false, loading: () => <div className="rounded-xl bg-surface animate-pulse" style={{ height: 340 }} /> },
)

type Filters = {
  credential: string   // '' | 'MD' | 'DO' | 'NP' | 'PA' | 'RN'
  minRating: number    // 0 | 4 | 4.5
  maxPrice: number     // 0 = no limit
  acceptsNew: boolean
  virtualConsult: boolean
  loyaltyProgram: string  // '' | 'alle' | 'aspire' | 'xperience'
}

type SortBy = 'rating' | 'reviews' | 'price'

const CREDENTIAL_OPTIONS = [
  { value: '', label: 'Any credential' },
  { value: 'MD', label: 'MD / DO' },
  { value: 'NP', label: 'NP / PA' },
  { value: 'RN', label: 'RN' },
]

const RATING_OPTIONS = [
  { value: 0, label: 'Any rating' },
  { value: 4, label: '4+ stars' },
  { value: 4.5, label: '4.5+ stars' },
]

export function ProviderFilters({ providers }: { providers: DirectoryProvider[] }) {
  const [filters, setFilters] = useState<Filters>({
    credential: '', minRating: 0, maxPrice: 0, acceptsNew: false, virtualConsult: false, loyaltyProgram: '',
  })
  const [sortBy, setSortBy] = useState<SortBy>('rating')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [mobileMapOpen, setMobileMapOpen] = useState(false)

  const filtered = useMemo(() => {
    return providers.filter((p) => {
      if (filters.credential) {
        const cred = p.credentials.toUpperCase()
        if (filters.credential === 'MD' && !['MD', 'DO'].some((c) => cred.includes(c))) return false
        if (filters.credential === 'NP' && !['NP', 'PA'].some((c) => cred.includes(c))) return false
        if (filters.credential === 'RN' && !cred.includes('RN')) return false
      }
      if (filters.minRating && (p.aggregateRating ?? 0) < filters.minRating) return false
      if (filters.maxPrice && (p.startingPrice ?? 9999) > filters.maxPrice) return false
      if (filters.acceptsNew && !p.acceptsNewPatients) return false
      if (filters.virtualConsult && !p.offersVirtualConsult) return false
      if (filters.loyaltyProgram && !(p.loyaltyPrograms ?? []).includes(filters.loyaltyProgram)) return false
      return true
    })
  }, [providers, filters])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortBy === 'rating') return (b.aggregateRating ?? 0) - (a.aggregateRating ?? 0)
      if (sortBy === 'reviews') return (b.aggregateRatingCount ?? 0) - (a.aggregateRatingCount ?? 0)
      if (sortBy === 'price') return (a.startingPrice ?? 9999) - (b.startingPrice ?? 9999)
      return 0
    })
  }, [filtered, sortBy])

  const active = sorted.find((p) => p.id === activeId) ?? null

  // Lock body scroll + handle Escape when full-screen map overlay is open
  useEffect(() => {
    if (!mobileMapOpen) return
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileMapOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKey)
    }
  }, [mobileMapOpen])

  return (
    <div>
      {/* Filter strip */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={filters.credential}
          onChange={(e) => setFilters((f) => ({ ...f, credential: e.target.value }))}
          className="px-3 py-2 rounded-pill border border-border text-body-sm text-ink-primary bg-surface-canvas focus:outline-none focus:border-brand-accent cursor-pointer"
          aria-label="Filter by credential"
        >
          {CREDENTIAL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          value={filters.minRating}
          onChange={(e) => setFilters((f) => ({ ...f, minRating: Number(e.target.value) }))}
          className="px-3 py-2 rounded-pill border border-border text-body-sm text-ink-primary bg-surface-canvas focus:outline-none focus:border-brand-accent cursor-pointer"
          aria-label="Filter by rating"
        >
          {RATING_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setFilters((f) => ({ ...f, acceptsNew: !f.acceptsNew }))}
          className={`px-4 py-2 rounded-pill border text-body-sm font-medium transition ${
            filters.acceptsNew
              ? 'bg-brand-primary text-surface-canvas border-brand-primary'
              : 'bg-surface-canvas text-ink-primary border-border hover:border-brand-accent'
          }`}
        >
          Accepting new patients
        </button>

        <button
          type="button"
          onClick={() => setFilters((f) => ({ ...f, virtualConsult: !f.virtualConsult }))}
          className={`px-4 py-2 rounded-pill border text-body-sm font-medium transition ${
            filters.virtualConsult
              ? 'bg-brand-primary text-surface-canvas border-brand-primary'
              : 'bg-surface-canvas text-ink-primary border-border hover:border-brand-accent'
          }`}
        >
          Virtual consults
        </button>

        <select
          value={filters.loyaltyProgram}
          onChange={(e) => setFilters((f) => ({ ...f, loyaltyProgram: e.target.value }))}
          className="px-3 py-2 rounded-pill border border-border text-body-sm text-ink-primary bg-surface-canvas focus:outline-none focus:border-brand-accent cursor-pointer"
          aria-label="Filter by loyalty program"
        >
          <option value="">Any loyalty program</option>
          <option value="alle">Accepts Allē</option>
          <option value="aspire">Accepts Aspire</option>
          <option value="xperience">Accepts Xperience</option>
        </select>

        {(filters.credential || filters.minRating || filters.acceptsNew || filters.virtualConsult || filters.loyaltyProgram) && (
          <button
            type="button"
            onClick={() => setFilters({ credential: '', minRating: 0, maxPrice: 0, acceptsNew: false, virtualConsult: false, loyaltyProgram: '' })}
            className="px-4 py-2 rounded-pill border border-border text-body-sm text-ink-secondary hover:text-brand-accent transition"
          >
            Clear filters
          </button>
        )}

        <div className="ml-auto flex items-center gap-2 self-center">
          <span className="text-caption text-ink-tertiary uppercase tracking-wider whitespace-nowrap">Sort by</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="px-3 py-2 rounded-pill border border-border text-body-sm text-ink-primary bg-surface-canvas focus:outline-none focus:border-brand-accent cursor-pointer"
            aria-label="Sort providers"
          >
            <option value="rating">Best rated</option>
            <option value="reviews">Most reviewed</option>
            <option value="price">Price (low to high)</option>
          </select>
        </div>
      </div>

      {/* List / Map toggle — mobile only */}
      <div className="flex md:hidden gap-1 mb-5 p-1 bg-surface rounded-pill border border-border w-fit" role="group" aria-label="View toggle">
        <button
          type="button"
          aria-pressed={!mobileMapOpen}
          onClick={() => setMobileMapOpen(false)}
          className={`px-5 py-1.5 rounded-pill text-body-sm font-medium transition ${
            !mobileMapOpen ? 'bg-brand-primary text-surface-canvas' : 'text-ink-secondary hover:text-ink-primary'
          }`}
        >
          List
        </button>
        <button
          type="button"
          aria-pressed={mobileMapOpen}
          onClick={() => setMobileMapOpen(true)}
          className={`flex items-center gap-1.5 px-5 py-1.5 rounded-pill text-body-sm font-medium transition ${
            mobileMapOpen ? 'bg-brand-primary text-surface-canvas' : 'text-ink-secondary hover:text-ink-primary'
          }`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
            <line x1="8" y1="2" x2="8" y2="18" />
            <line x1="16" y1="6" x2="16" y2="22" />
          </svg>
          Map
        </button>
      </div>

      {/* Inline map — desktop only */}
      <div className="hidden md:block mb-6">
        <DirectoryMap
          providers={sorted}
          activeId={activeId}
          onPinClick={(id) => setActiveId((prev) => (prev === id ? null : id))}
          height="340px"
        />
      </div>

      {/* Full-screen map overlay — mobile only */}
      {mobileMapOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label="Map view"
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-surface-canvas border-b border-border shadow-sm flex-shrink-0">
            <span className="text-body-sm font-semibold text-ink-primary">
              {filtered.length} provider{filtered.length !== 1 ? 's' : ''} on map
            </span>
            <button
              type="button"
              onClick={() => setMobileMapOpen(false)}
              aria-label="Back to list"
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-pill border border-border text-body-sm text-ink-secondary hover:text-ink-primary hover:bg-surface transition"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="8" y1="6" x2="2" y2="12" /><line x1="2" y1="12" x2="8" y2="18" />
                <path d="M2 12h20" />
              </svg>
              List
            </button>
          </div>

          {/* Full-height map — no border/radius since the overlay itself frames it */}
          <div className="flex-1 min-h-0">
            <DirectoryMap
              providers={sorted}
              activeId={activeId}
              onPinClick={(id) => setActiveId((prev) => (prev === id ? null : id))}
              height="100%"
              className="overflow-hidden"
            />
          </div>
        </div>
      )}

      {/* Provider grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-ink-secondary">
          <p className="text-body">No providers match your filters.</p>
          <button
            type="button"
            onClick={() => setFilters({ credential: '', minRating: 0, maxPrice: 0, acceptsNew: false, virtualConsult: false, loyaltyProgram: '' })}
            className="mt-3 text-brand-accent text-body-sm hover:underline"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sorted.map((p, i) => (
            <div
              key={p.id}
              onMouseEnter={() => setActiveId(p.id)}
              onMouseLeave={() => setActiveId(null)}
              onClick={() => setActiveId((prev) => (prev === p.id ? null : p.id))}
            >
              <DirectoryProviderCard provider={p} index={i} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
