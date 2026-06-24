'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { DirectoryProviderCard } from '@/components/shared/DirectoryProviderCard'
import { DirectoryClinicCard } from '@/components/shared/DirectoryClinicCard'
import type { NeighborhoodHubData } from '@/lib/location-queries'

type Props = { data: NeighborhoodHubData; schema: object[]; initialTreatmentId?: string }

const TABS = ['Injectors', 'Clinics'] as const

export function NeighborhoodHubPage({ data, schema, initialTreatmentId }: Props) {
  const { state, city, neighborhood, providers, clinics, treatments } = data
  const cityDisplay = city.name.replace(/\s+city$/i, '')
  const [selectedTid, setSelectedTid] = useState(initialTreatmentId ?? '')
  const [tab, setTab] = useState<'Injectors' | 'Clinics'>('Injectors')

  const selectedTreatment = useMemo(() => treatments.find((t) => t.id === selectedTid), [selectedTid, treatments])

  const filteredProviders = useMemo(() =>
    selectedTreatment ? providers.filter((p) => p.treatments.includes(selectedTreatment.name)) : providers,
    [providers, selectedTreatment],
  )
  const filteredClinics = useMemo(() =>
    selectedTreatment ? clinics.filter((c) => (c.treatmentsOffered ?? []).includes(selectedTreatment.name)) : clinics,
    [clinics, selectedTreatment],
  )

  return (
    <>
      {schema.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s).replace(/</g, '\\u003c') }} />
      ))}

      {/* Breadcrumb */}
      <div className="bg-surface border-b border-border">
        <div className="max-canvas py-3">
          <nav className="flex items-center gap-2 text-caption text-ink-tertiary flex-wrap" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-ink-primary transition">Home</Link>
            <span>/</span>
            <Link href={`/${state.slug}`} className="hover:text-ink-primary transition">{state.name}</Link>
            <span>/</span>
            <Link href={`/${state.slug}/${city.slug}`} className="hover:text-ink-primary transition">{cityDisplay}</Link>
            <span>/</span>
            <span className="text-ink-primary">{neighborhood.name}</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="bg-[#0B1B34] text-white pt-14 pb-10">
        <div className="max-canvas">
          <p className="text-overline text-brand-accent mb-3 tracking-widest uppercase font-semibold">{cityDisplay}, {state.name}</p>
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight mb-4">
            Injectors near {neighborhood.name}
          </h1>
          <p className="font-serif text-lede-m md:text-lede text-white/70 max-w-[600px]">
            License-verified aesthetic providers and clinics serving {neighborhood.name} and the surrounding area.
          </p>
        </div>
      </section>

      {/* Treatment filter chips */}
      {treatments.length > 0 && (
        <div className="bg-surface border-b border-border">
          <div className="max-canvas py-3">
            <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-5 px-5 md:mx-0 md:px-0 md:flex-wrap">
              <button
                onClick={() => setSelectedTid('')}
                className={`flex-shrink-0 px-4 py-1.5 rounded-pill text-body-sm font-medium transition ${
                  !selectedTid ? 'bg-brand-primary text-surface-canvas' : 'border border-border text-ink-secondary hover:border-brand-accent hover:text-brand-accent'
                }`}
              >
                All treatments
              </button>
              {treatments.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTid(selectedTid === t.id ? '' : t.id)}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-pill text-body-sm font-medium transition ${
                    selectedTid === t.id ? 'bg-brand-accent text-white' : 'border border-border text-ink-secondary hover:border-brand-accent hover:text-brand-accent'
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <section className="section-pad bg-surface-canvas">
        <div className="max-canvas">
          {/* Tabs */}
          {clinics.length > 0 && (
            <div className="flex gap-1 border-b border-border mb-8">
              {TABS.map((t) => {
                const count = t === 'Injectors' ? filteredProviders.length : filteredClinics.length
                return (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`pb-3 px-4 text-body-sm font-semibold transition -mb-px ${
                      tab === t
                        ? 'text-brand-accent border-b-2 border-brand-accent'
                        : 'text-ink-tertiary hover:text-ink-secondary border-b-2 border-transparent'
                    }`}
                  >
                    {t} {count > 0 && <span className="ml-1 text-ink-tertiary font-normal">({count})</span>}
                  </button>
                )
              })}
            </div>
          )}

          {/* Providers tab */}
          <div className={tab === 'Injectors' ? '' : 'hidden'}>
            {filteredProviders.length > 0 ? (
              <>
                <h2 className="font-serif text-h2 text-ink-primary mb-6">
                  {filteredProviders.length} {filteredProviders.length === 1 ? 'injector' : 'injectors'} near {neighborhood.name}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
                  {filteredProviders.map((p) => (
                    <DirectoryProviderCard key={p.id} provider={p} />
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-16">
                <p className="text-body text-ink-secondary mb-2">
                  No verified providers listed in {neighborhood.name} yet
                  {selectedTreatment ? ` for ${selectedTreatment.name}` : ''}.
                </p>
                {selectedTreatment ? (
                  <button onClick={() => setSelectedTid('')} className="text-brand-accent text-body-sm hover:underline mt-1">
                    Show all treatments
                  </button>
                ) : (
                  <Link href={`/${state.slug}/${city.slug}`} className="text-brand-accent text-body-sm hover:underline">
                    Browse all of {cityDisplay}
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Clinics tab */}
          {clinics.length > 0 && (
            <div className={tab === 'Clinics' ? '' : 'hidden'}>
              {filteredClinics.length > 0 ? (
                <>
                  <h2 className="font-serif text-h2 text-ink-primary mb-6">
                    Clinics near {neighborhood.name}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
                    {filteredClinics.map((c) => (
                      <DirectoryClinicCard key={c.id} c={c} />
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-16">
                  <p className="text-body text-ink-secondary mb-2">
                    No clinics listed near {neighborhood.name}{selectedTreatment ? ` for ${selectedTreatment.name}` : ''}.
                  </p>
                  {selectedTreatment && (
                    <button onClick={() => setSelectedTid('')} className="text-brand-accent text-body-sm hover:underline">
                      Show all treatments
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Back to city */}
          <div className="mt-12 pt-8 border-t border-border">
            <Link href={`/${state.slug}/${city.slug}`} className="flex items-center gap-1.5 text-body-sm text-brand-accent font-medium hover:underline">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              All injectors in {cityDisplay}
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
