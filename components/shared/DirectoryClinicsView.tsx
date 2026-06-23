'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { DirectoryClinicCard } from './DirectoryClinicCard'
import type { DirectoryClinic } from '@/lib/location-queries'
import type { MapPin } from '@/components/ui/ListingMapInner'
import { useSaved } from '@/components/account/SavedItemsProvider'
import { GateSection, FREE_COUNT } from '@/components/ui/GateSection'

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

export function DirectoryClinicsView({ clinics }: { clinics: DirectoryClinic[] }) {
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const { isSaved, toggle, loggedIn, ready } = useSaved()
  const [activeMapPin, setActiveMapPin] = useState<string | null>(null)
  const locked = ready && !loggedIn && clinics.length > FREE_COUNT

  if (clinics.length === 0) {
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

  const mapPins: MapPin[] = clinics.map((c) => ({
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
    <div>
      {/* Count + view toggle */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <p className="text-body-sm text-ink-tertiary">
          {clinics.length} {clinics.length === 1 ? 'clinic' : 'clinics'}
          {clinics.filter((c) => isSaved('clinic', c.id)).length > 0 && (
            <span className="ml-3 inline-flex items-center gap-1.5 text-brand-accent">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
              </svg>
              {clinics.filter((c) => isSaved('clinic', c.id)).length} saved
            </span>
          )}
        </p>

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

      {/* Map */}
      {viewMode === 'map' && (
        <div className="mb-6">
          <ListingMapInner
            pins={mapPins}
            activePinId={activeMapPin}
            onPinClick={setActiveMapPin}
            height={460}
          />
          <p className="text-caption text-ink-tertiary mt-2 text-center">Click a pin to highlight the clinic below.</p>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-5">
        {clinics.slice(0, locked ? FREE_COUNT : clinics.length).map((c) => (
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
        total={clinics.length}
        label="clinics"
        previewItems={clinics.slice(FREE_COUNT, FREE_COUNT + 2).map((c) => (
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
    </div>
  )
}
