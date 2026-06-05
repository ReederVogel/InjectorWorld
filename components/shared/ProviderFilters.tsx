'use client'

import dynamic from 'next/dynamic'
import { useState, useMemo } from 'react'
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
}

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
  const [filters, setFilters] = useState<Filters>({ credential: '', minRating: 0, maxPrice: 0, acceptsNew: false })
  const [activeId, setActiveId] = useState<string | null>(null)

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
      return true
    })
  }, [providers, filters])

  const active = filtered.find((p) => p.id === activeId) ?? null

  return (
    <div>
      {/* Filter strip */}
      <div className="flex flex-wrap gap-2 mb-6">
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

        {(filters.credential || filters.minRating || filters.acceptsNew) && (
          <button
            type="button"
            onClick={() => setFilters({ credential: '', minRating: 0, maxPrice: 0, acceptsNew: false })}
            className="px-4 py-2 rounded-pill border border-border text-body-sm text-ink-secondary hover:text-brand-accent transition"
          >
            Clear filters
          </button>
        )}

        <span className="ml-auto text-body-sm text-ink-tertiary self-center">
          {filtered.length} provider{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Map */}
      <div className="mb-6">
        <DirectoryMap
          providers={filtered}
          activeId={activeId}
          onPinClick={(id) => setActiveId((prev) => (prev === id ? null : id))}
          height="340px"
        />
      </div>

      {/* Provider grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-ink-secondary">
          <p className="text-body">No providers match your filters.</p>
          <button
            type="button"
            onClick={() => setFilters({ credential: '', minRating: 0, maxPrice: 0, acceptsNew: false })}
            className="mt-3 text-brand-accent text-body-sm hover:underline"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((p, i) => (
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
