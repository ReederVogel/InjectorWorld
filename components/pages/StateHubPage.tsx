'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { DirectoryProviderCard } from '@/components/shared/DirectoryProviderCard'
import { ProviderClinicResults } from '@/components/shared/ProviderClinicResults'
import { DirectoryClinicCard } from '@/components/shared/DirectoryClinicCard'
import { ListingFilters } from '@/components/shared/ListingFilters'
import { StateCityCombobox } from '@/components/shared/StateCityCombobox'
import {
  DEFAULT_LISTING_FILTERS,
  applyListingFilters,
  type ListingFilterValues,
} from '@/components/shared/applyListingFilters'
import type { StateHubData } from '@/lib/location-queries'
import type { SponsoredProvider } from '@/lib/promotions'

type Props = { data: StateHubData; sponsored: SponsoredProvider[]; schema: object[] }

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group rounded-xl border border-border bg-surface overflow-hidden">
      <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none select-none hover:bg-surface-canvas transition">
        <span className="font-medium text-body text-ink-primary">{question}</span>
        <svg className="flex-shrink-0 w-5 h-5 text-ink-tertiary group-open:rotate-180 group-open:text-brand-accent transition-transform duration-200"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </summary>
      <div className="px-5 pb-5 pt-3 border-t border-border-subtle text-body-sm text-ink-secondary leading-relaxed">{answer}</div>
    </details>
  )
}

export function StateHubPage({ data, sponsored, schema }: Props) {
  const { state, allCities, services: treatments, brands, providers, clinics, faqs, totalClinics } = data
  const [selectedTid, setSelectedTid] = useState('')
  const [listingFilters, setListingFilters] = useState<ListingFilterValues>(DEFAULT_LISTING_FILTERS)
  const [allClinics, setAllClinics] = useState(clinics)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const selectedTreatment = useMemo(() => treatments.find((t) => t.id === selectedTid), [selectedTid, treatments])

  const treatmentProviders = useMemo(() =>
    selectedTreatment ? providers.filter((p) => p.treatments.includes(selectedTreatment.name)) : providers,
    [providers, selectedTreatment],
  )
  const filteredProviders = useMemo(
    () => applyListingFilters(treatmentProviders, listingFilters, 'provider').items,
    [treatmentProviders, listingFilters],
  )
  const filteredClinics = useMemo(
    () => applyListingFilters(allClinics, listingFilters, 'clinic').items,
    [allClinics, listingFilters],
  )
  const filteredSponsored = useMemo(() =>
    selectedTreatment ? sponsored.filter((p) => p.treatments.includes(selectedTreatment.name)) : sponsored,
    [sponsored, selectedTreatment],
  )
  const hasMore = allClinics.length < totalClinics

  useEffect(() => {
    setAllClinics(clinics)
    setPage(1)
    setLoadError(null)
  }, [clinics, state.slug])

  async function loadMore() {
    if (isLoading || !hasMore) return
    setIsLoading(true)
    setLoadError(null)

    const nextPage = page + 1
    try {
      const res = await fetch(`/api/state-clinics?stateSlug=${encodeURIComponent(state.slug)}&page=${nextPage}&limit=24`)
      if (!res.ok) throw new Error('Unable to load more clinics.')

      const json = await res.json() as { clinics?: StateHubData['clinics'] }
      const nextClinics = Array.isArray(json.clinics) ? json.clinics : []

      setAllClinics((prev) => {
        const seen = new Set(prev.map((clinic) => clinic.id))
        return [...prev, ...nextClinics.filter((clinic) => !seen.has(clinic.id))]
      })
      setPage(nextPage)
    } catch {
      setLoadError('Could not load more clinics. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      {schema.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s).replace(/</g, '\\u003c') }} />
      ))}

      {/* Breadcrumb */}
      <div className="bg-surface border-b border-border">
        <div className="max-canvas py-3">
          <nav className="flex items-center gap-2 text-caption text-ink-tertiary" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-ink-primary transition">Home</Link>
            <span>/</span>
            <span className="text-ink-primary">{state.name}</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="bg-surface-canvas pt-10 pb-8 border-b border-border">
        <div className="max-canvas">
          <span className="text-overline uppercase tracking-widest font-semibold text-brand-accent mb-3 block">
            Injector Directory
          </span>
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-3">
            Find a verified injector in {state.name}
          </h1>
          <p className="text-body-lg text-ink-secondary max-w-2xl">
            Browse license-verified Botox and aesthetic injectors across {state.name}. Real patient reviews.
          </p>
        </div>
      </section>

      {allCities.length > 0 && (
        <div className="bg-surface border-b border-border">
          <div className="max-canvas py-3 max-w-sm">
            <StateCityCombobox stateSlug={state.slug} stateName={state.name} cities={allCities} />
          </div>
        </div>
      )}

      {/* Service + Brand filter strip */}
      {(treatments.length > 0 || brands.length > 0) && (
        <div className="bg-surface border-b border-border">
          <div className="max-canvas py-3 space-y-2.5">
            {treatments.length > 0 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-5 px-5 md:mx-0 md:px-0 md:flex-wrap">
                <span className="flex-shrink-0 text-caption text-ink-tertiary uppercase tracking-wider font-semibold self-center mr-1 hidden md:inline">Services</span>
                <button
                  onClick={() => setSelectedTid('')}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-pill text-body-sm font-medium transition ${
                    !selectedTid ? 'bg-brand-primary text-surface-canvas' : 'border border-border text-ink-secondary hover:border-brand-accent hover:text-brand-accent'
                  }`}
                >
                  All services
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
            )}
            {brands.length > 0 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-5 px-5 md:mx-0 md:px-0 md:flex-wrap">
                <span className="flex-shrink-0 text-caption text-ink-tertiary uppercase tracking-wider font-semibold self-center mr-1 hidden md:inline">Brands</span>
                {brands.map((b) => (
                  <Link
                    key={b.id}
                    href={`/brands/${b.slug}/${state.slug}`}
                    className="flex-shrink-0 px-4 py-1.5 rounded-pill border border-border text-body-sm font-medium text-ink-secondary hover:border-brand-accent hover:text-brand-accent transition"
                  >
                    {b.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="section-pad bg-surface-canvas">
        <div className="max-canvas space-y-14">

          {/* Sponsored */}
          {filteredSponsored.length > 0 && (
            <div>
              <p className="text-caption text-ink-tertiary font-medium uppercase tracking-widest mb-3">Sponsored</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {filteredSponsored.map((p) => <DirectoryProviderCard key={p.id} provider={p} />)}
              </div>
            </div>
          )}

          <div className="md:flex md:items-start md:gap-6">
            <ListingFilters
              items={[...treatmentProviders, ...allClinics]}
              mode="mixed"
              resultCount={filteredProviders.length + filteredClinics.length}
              totalCount={treatmentProviders.length + allClinics.length}
              onChange={setListingFilters}
              brandOptions={brands.map((b) => ({ id: b.id, name: b.name }))}
              serviceOptions={treatments.map((t) => ({ id: t.id, name: t.name }))}
            />

            <div className="min-w-0 flex-1 space-y-14 pb-20 md:pb-0">
              {/* Top Clinics */}
              {filteredClinics.length > 0 && (
                <div>
                  <h2 className="font-serif text-h2 text-ink-primary mb-6">Top Clinics in {state.name}</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                    {filteredClinics.map((c) => (
                      <DirectoryClinicCard key={c.id} c={c} />
                    ))}
                  </div>

                  {loadError && (
                    <p className="mt-4 text-body-sm text-red-700 text-center" role="status">
                      {loadError}
                    </p>
                  )}

                  {hasMore && (
                    <div className="mt-6 text-center">
                      <button
                        type="button"
                        onClick={loadMore}
                        disabled={isLoading}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-pill border border-border text-body-sm font-medium text-ink-primary hover:border-brand-accent hover:bg-surface transition disabled:opacity-50"
                      >
                        {isLoading ? 'Loading...' : `Load more clinics (${totalClinics - allClinics.length} remaining)`}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Top Injectors */}
              {filteredProviders.length > 0 && (
                <div>
                  <h2 className="font-serif text-h2 text-ink-primary mb-2">
                    {selectedTreatment ? `${selectedTreatment.name} injectors` : 'Injectors'} in {state.name}
                  </h2>
                  <p className="text-body-sm text-ink-secondary mb-6">
                    License-verified providers across {state.name}, ranked by rating, reviews, and profile completeness.
                  </p>
                  <ProviderClinicResults key={`${selectedTid}-${filteredProviders.length}`} providers={filteredProviders} clinics={[]} />
                </div>
              )}

              {filteredProviders.length === 0 && filteredClinics.length === 0 && (
                <div className="rounded-2xl border border-border bg-surface p-8 text-center">
                  <p className="text-body text-ink-secondary">No listings match your filters.</p>
                </div>
              )}
            </div>
          </div>

          {/* FAQs */}
          {faqs.length > 0 && (
            <div>
              <h2 className="font-serif text-h2 text-ink-primary mb-5">Frequently asked questions</h2>
              <div className="space-y-2 max-w-3xl">
                {faqs.map((f) => <FaqItem key={f.id} question={f.question} answer={f.answer} />)}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
