'use client'

import { useState } from 'react'
import { DirectoryProviderCard } from '@/components/shared/DirectoryProviderCard'
import { DirectoryClinicCard } from '@/components/shared/DirectoryClinicCard'
import type { DirectoryProvider, DirectoryClinic } from '@/lib/location-queries'

const PAGE_SIZE = 12

type Tab = 'providers' | 'clinics'

export function TreatmentDirectory({
  providers,
  clinics,
  treatmentName,
}: {
  providers: DirectoryProvider[]
  clinics: DirectoryClinic[]
  treatmentName: string
}) {
  const [tab, setTab] = useState<Tab>('providers')
  const [visibleProviders, setVisibleProviders] = useState(PAGE_SIZE)
  const [visibleClinics, setVisibleClinics] = useState(PAGE_SIZE)

  const shownProviders = providers.slice(0, visibleProviders)
  const shownClinics = clinics.slice(0, visibleClinics)

  return (
    <div>
      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-border mb-8">
        <TabBtn active={tab === 'providers'} onClick={() => setTab('providers')}>
          Injectors
          <span className={`ml-1.5 text-[11px] font-medium ${tab === 'providers' ? 'text-brand-accent' : 'text-ink-tertiary'}`}>
            {providers.length}
          </span>
        </TabBtn>
        <TabBtn active={tab === 'clinics'} onClick={() => setTab('clinics')}>
          Clinics
          <span className={`ml-1.5 text-[11px] font-medium ${tab === 'clinics' ? 'text-brand-accent' : 'text-ink-tertiary'}`}>
            {clinics.length}
          </span>
        </TabBtn>
      </div>

      {/* Providers panel */}
      {tab === 'providers' && (
        providers.length === 0 ? (
          <EmptyState type="injectors" treatmentName={treatmentName} />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {shownProviders.map((p, i) => (
                <DirectoryProviderCard key={p.id} provider={p} index={i} />
              ))}
            </div>
            {visibleProviders < providers.length && (
              <LoadMore
                shown={shownProviders.length}
                total={providers.length}
                label="injectors"
                onMore={() => setVisibleProviders((v) => v + PAGE_SIZE)}
              />
            )}
          </>
        )
      )}

      {/* Clinics panel */}
      {tab === 'clinics' && (
        clinics.length === 0 ? (
          <EmptyState type="clinics" treatmentName={treatmentName} />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {shownClinics.map((c) => (
                <DirectoryClinicCard key={c.id} c={c} />
              ))}
            </div>
            {visibleClinics < clinics.length && (
              <LoadMore
                shown={shownClinics.length}
                total={clinics.length}
                label="clinics"
                onMore={() => setVisibleClinics((v) => v + PAGE_SIZE)}
              />
            )}
          </>
        )
      )}
    </div>
  )
}

// ─── Tab button ──────────────────────────────────────────────────────────────

function TabBtn({
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
      className={`flex items-center px-4 py-3 text-body-sm font-semibold border-b-2 transition-colors ${
        active
          ? 'border-brand-accent text-ink-primary'
          : 'border-transparent text-ink-secondary hover:text-ink-primary'
      }`}
    >
      {children}
    </button>
  )
}

// ─── Load more ────────────────────────────────────────────────────────────────

function LoadMore({
  shown,
  total,
  label,
  onMore,
}: {
  shown: number
  total: number
  label: string
  onMore: () => void
}) {
  return (
    <div className="mt-10 flex flex-col items-center gap-3">
      <p className="text-body-sm text-ink-tertiary">
        Showing {shown} of {total} {label}
      </p>
      <button
        onClick={onMore}
        className="px-6 py-3 rounded-pill border border-border bg-surface-canvas text-body-sm font-semibold text-ink-primary hover:border-brand-accent hover:bg-surface transition"
      >
        Load more {label}
      </button>
    </div>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ type, treatmentName }: { type: string; treatmentName: string }) {
  return (
    <div className="text-center py-20">
      <p className="text-body text-ink-secondary">
        No verified {type} offering {treatmentName} yet.
      </p>
      <p className="text-body-sm text-ink-tertiary mt-2">
        Check back soon — we verify new providers regularly.
      </p>
    </div>
  )
}
