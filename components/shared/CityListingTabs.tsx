'use client'

import { useState, type ReactNode } from 'react'

type Tab = 'providers' | 'clinics'

export function CityListingTabs({
  providerCount,
  clinicCount,
  providersView,
  clinicsView,
}: {
  providerCount: number
  clinicCount: number
  providersView: ReactNode
  clinicsView: ReactNode
}) {
  const [tab, setTab] = useState<Tab>('providers')

  return (
    <div>
      {/* Providers | Clinics toggle */}
      <div
        className="inline-flex gap-1 mb-6 p-1 bg-surface rounded-pill border border-border"
        role="tablist"
        aria-label="Listing type"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'providers'}
          onClick={() => setTab('providers')}
          className={`px-5 py-2 rounded-pill text-body-sm font-medium transition ${
            tab === 'providers' ? 'bg-brand-primary text-surface-canvas' : 'text-ink-secondary hover:text-ink-primary'
          }`}
        >
          Providers
          <span className={`ml-1.5 ${tab === 'providers' ? 'text-surface-canvas/70' : 'text-ink-tertiary'}`}>
            {providerCount}
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'clinics'}
          onClick={() => setTab('clinics')}
          className={`px-5 py-2 rounded-pill text-body-sm font-medium transition ${
            tab === 'clinics' ? 'bg-brand-primary text-surface-canvas' : 'text-ink-secondary hover:text-ink-primary'
          }`}
        >
          Clinics
          <span className={`ml-1.5 ${tab === 'clinics' ? 'text-surface-canvas/70' : 'text-ink-tertiary'}`}>
            {clinicCount}
          </span>
        </button>
      </div>

      {/* Both panels stay mounted (toggled with `hidden`) so clinic anchor links
          are in the server-rendered HTML for crawlers and tab switches are instant. */}
      <div role="tabpanel" hidden={tab !== 'providers'}>
        {providersView}
      </div>
      <div role="tabpanel" hidden={tab !== 'clinics'}>
        {clinicsView}
      </div>
    </div>
  )
}
