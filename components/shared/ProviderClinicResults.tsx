'use client'

import { useEffect, useState } from 'react'
import { DirectoryProviderCard } from './DirectoryProviderCard'
import { DirectoryClinicCard } from './DirectoryClinicCard'
import type { DirectoryProvider, DirectoryClinic } from '@/lib/location-queries'

const PAGE = 12

/**
 * Generic, paginated Providers | Clinics result list.
 * Used by the state hub and the /search page. Providers arrive already
 * merit-ordered from the server; this component only handles tabbing,
 * the "Load more" window, and saved-clinic state.
 *
 * Both panels stay mounted (toggled via `hidden`) so provider/clinic anchor
 * links are present in the server-rendered HTML for crawlers.
 */
export function ProviderClinicResults({
  providers,
  clinics,
  initialTab = 'providers',
}: {
  providers: DirectoryProvider[]
  clinics: DirectoryClinic[]
  initialTab?: 'providers' | 'clinics'
}) {
  const hasClinics = clinics.length > 0
  const [tab, setTab] = useState<'providers' | 'clinics'>(
    initialTab === 'clinics' && hasClinics ? 'clinics' : 'providers',
  )
  const [pVisible, setPVisible] = useState(PAGE)
  const [cVisible, setCVisible] = useState(PAGE)
  const [savedClinics, setSavedClinics] = useState<Set<string>>(new Set())

  // Share the saved-clinics list with /clinics and the city pages.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('iw_saved_clinics')
      if (raw) setSavedClinics(new Set(JSON.parse(raw)))
    } catch {}
  }, [])
  useEffect(() => {
    localStorage.setItem('iw_saved_clinics', JSON.stringify([...savedClinics]))
  }, [savedClinics])

  const toggleClinic = (id: string) =>
    setSavedClinics((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  return (
    <div>
      {/* Providers | Clinics toggle (Clinics only when present) */}
      {hasClinics && (
        <div
          className="inline-flex gap-1 mb-6 p-1 bg-surface rounded-pill border border-border"
          role="tablist"
          aria-label="Listing type"
        >
          {(['providers', 'clinics'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-pill text-body-sm font-medium capitalize transition ${
                tab === t ? 'bg-brand-primary text-surface-canvas' : 'text-ink-secondary hover:text-ink-primary'
              }`}
            >
              {t}
              <span className={`ml-1.5 ${tab === t ? 'text-surface-canvas/70' : 'text-ink-tertiary'}`}>
                {t === 'providers' ? providers.length : clinics.length}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Providers panel */}
      <div role="tabpanel" hidden={tab !== 'providers'}>
        {providers.length === 0 ? (
          <p className="text-body text-ink-secondary py-8">No injectors found yet.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {providers.slice(0, pVisible).map((p, i) => (
                <DirectoryProviderCard key={p.id} provider={p} index={i} />
              ))}
            </div>
            {pVisible < providers.length && (
              <div className="mt-8 flex flex-col items-center gap-3">
                <p className="text-body-sm text-ink-tertiary">
                  Showing {Math.min(pVisible, providers.length)} of {providers.length}
                </p>
                <button
                  onClick={() => setPVisible((c) => c + PAGE)}
                  className="px-6 py-3 rounded-pill border border-border bg-surface-canvas text-body-sm font-semibold text-ink-primary hover:border-brand-accent hover:bg-surface transition"
                >
                  Load more injectors
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Clinics panel */}
      {hasClinics && (
        <div role="tabpanel" hidden={tab !== 'clinics'}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {clinics.slice(0, cVisible).map((c) => (
              <DirectoryClinicCard
                key={c.id}
                c={c}
                isSaved={savedClinics.has(c.id)}
                isHighlighted={false}
                dist={null}
                onSave={() => toggleClinic(c.id)}
              />
            ))}
          </div>
          {cVisible < clinics.length && (
            <div className="mt-8 flex flex-col items-center gap-3">
              <p className="text-body-sm text-ink-tertiary">
                Showing {Math.min(cVisible, clinics.length)} of {clinics.length}
              </p>
              <button
                onClick={() => setCVisible((c) => c + PAGE)}
                className="px-6 py-3 rounded-pill border border-border bg-surface-canvas text-body-sm font-semibold text-ink-primary hover:border-brand-accent hover:bg-surface transition"
              >
                Load more clinics
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
