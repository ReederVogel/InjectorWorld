'use client'

import { useState } from 'react'
import { DirectoryProviderCard } from './DirectoryProviderCard'
import { DirectoryClinicCard } from './DirectoryClinicCard'
import type { DirectoryProvider, DirectoryClinic } from '@/lib/location-queries'
import { useSaved } from '@/components/account/SavedItemsProvider'
import { GateSection, FREE_COUNT } from '@/components/ui/GateSection'

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
  initialTab = 'clinics',
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
  const { isSaved, toggle, loggedIn, ready } = useSaved()
  const pLocked = ready && !loggedIn && providers.length > FREE_COUNT
  const cLocked = ready && !loggedIn && clinics.length > FREE_COUNT

  return (
    <div>
      {/* Providers | Clinics toggle (Clinics only when present) */}
      {hasClinics && (
        <div
          className="inline-flex gap-1 mb-6 p-1 bg-surface rounded-pill border border-border"
          role="tablist"
          aria-label="Listing type"
        >
          {(['clinics', 'providers'] as const).map((t) => (
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
              {providers.slice(0, pLocked ? FREE_COUNT : pVisible).map((p, i) => (
                <DirectoryProviderCard key={p.id} provider={p} index={i} />
              ))}
            </div>
            <GateSection
              locked={pLocked}
              total={providers.length}
              label="injectors"
              previewItems={providers.slice(FREE_COUNT, FREE_COUNT + 3).map((p, i) => (
                <DirectoryProviderCard key={p.id} provider={p} index={FREE_COUNT + i} />
              ))}
            />
            {!pLocked && pVisible < providers.length && (
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
            {clinics.slice(0, cLocked ? FREE_COUNT : cVisible).map((c) => (
              <DirectoryClinicCard
                key={c.id}
                c={c}
                isSaved={isSaved('clinic', c.id)}
                isHighlighted={false}
                dist={null}
                onSave={() => toggle('clinic', c.id)}
              />
            ))}
          </div>
          <GateSection
            locked={cLocked}
            total={clinics.length}
            label="clinics"
            previewItems={clinics.slice(FREE_COUNT, FREE_COUNT + 3).map((c) => (
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
          {!cLocked && cVisible < clinics.length && (
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
