'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { DirectoryProviderCard } from '@/components/shared/DirectoryProviderCard'
import { ProviderClinicResults } from '@/components/shared/ProviderClinicResults'
import { DirectoryClinicCard } from '@/components/shared/DirectoryClinicCard'
import { ListingFilters } from '@/components/shared/ListingFilters'
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
  const { state, cities, services: treatments, brands, providers, clinics, faqs } = data
  const [selectedTid, setSelectedTid] = useState('')
  const [listingFilters, setListingFilters] = useState<ListingFilterValues>(DEFAULT_LISTING_FILTERS)

  const selectedTreatment = useMemo(() => treatments.find((t) => t.id === selectedTid), [selectedTid, treatments])

  const treatmentProviders = useMemo(() =>
    selectedTreatment ? providers.filter((p) => p.treatments.includes(selectedTreatment.name)) : providers,
    [providers, selectedTreatment],
  )
  const treatmentClinics = useMemo(() => clinics, [clinics])
  const filteredProviders = useMemo(
    () => applyListingFilters(treatmentProviders, listingFilters, 'provider').items,
    [treatmentProviders, listingFilters],
  )
  const filteredClinics = useMemo(
    () => applyListingFilters(treatmentClinics, listingFilters, 'clinic').items,
    [treatmentClinics, listingFilters],
  )
  const filteredSponsored = useMemo(() =>
    selectedTreatment ? sponsored.filter((p) => p.treatments.includes(selectedTreatment.name)) : sponsored,
    [sponsored, selectedTreatment],
  )

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
              items={[...treatmentProviders, ...treatmentClinics]}
              mode="mixed"
              resultCount={filteredProviders.length + filteredClinics.length}
              totalCount={treatmentProviders.length + treatmentClinics.length}
              onChange={setListingFilters}
              brandOptions={brands.map((b) => ({ id: b.id, name: b.name }))}
              serviceOptions={treatments.map((t) => ({ id: t.id, name: t.name }))}
            />

            <div className="min-w-0 flex-1 space-y-14 pb-20 md:pb-0">
              {/* Top Clinics */}
              {filteredClinics.length > 0 && (
                <div>
                  <div className="flex items-baseline justify-between mb-6">
                    <h2 className="font-serif text-h2 text-ink-primary">Top Clinics in {state.name}</h2>
                    <Link href="/clinics" className="text-body-sm text-brand-accent font-medium hover:underline flex items-center gap-1">
                      View all
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                    {filteredClinics.slice(0, 6).map((c) => (
                      <DirectoryClinicCard key={c.id} c={c} />
                    ))}
                  </div>
                  {filteredClinics.length > 6 && (
                    <div className="mt-6 text-center">
                      <Link
                        href="/clinics"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-pill border border-border text-body-sm font-medium text-ink-primary hover:border-brand-accent hover:bg-surface transition"
                      >
                        View all {filteredClinics.length} clinics in {state.name}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                      </Link>
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

          {/* By Service */}
          {treatments.length > 0 && (
            <div>
              <h2 className="font-serif text-h2 text-ink-primary mb-6">Browse by service in {state.name}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {treatments.map((t) => (
                  <Link
                    key={t.id}
                    href={`/services/${t.slug}/${state.slug}`}
                    className="group flex flex-col p-4 rounded-xl border border-border bg-surface hover:border-brand-accent hover:bg-surface-warm transition-all"
                  >
                    <span className="font-medium text-body-sm text-ink-primary group-hover:text-brand-accent transition leading-tight">{t.name}</span>
                    {t.tagline && <span className="text-caption text-ink-tertiary mt-1 leading-snug line-clamp-2">{t.tagline}</span>}
                    <span className="mt-auto pt-2 flex items-center gap-1 text-caption text-brand-accent font-medium">
                      Browse
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* By Brand */}
          {brands.length > 0 && (
            <div>
              <h2 className="font-serif text-h2 text-ink-primary mb-6">Browse by brand in {state.name}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {brands.map((b) => (
                  <Link
                    key={b.id}
                    href={`/brands/${b.slug}/${state.slug}`}
                    className="group flex items-center justify-between p-4 rounded-xl border border-border bg-surface hover:border-brand-accent hover:bg-surface-warm transition-all"
                  >
                    <span className="font-medium text-body-sm text-ink-primary group-hover:text-brand-accent transition leading-tight">{b.name}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-tertiary group-hover:text-brand-accent flex-shrink-0">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* By City */}
          {cities.length > 0 && (
            <div>
              <h2 className="font-serif text-h2 text-ink-primary mb-6">Browse by city</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {cities.map((c) => (
                  <Link
                    key={c.id}
                    href={`/${state.slug}/${c.slug}`}
                    className="group flex items-center justify-between p-4 rounded-xl border border-border bg-surface hover:border-brand-accent hover:bg-surface-warm transition-all"
                  >
                    <div>
                      <div className="font-medium text-body-sm text-ink-primary group-hover:text-brand-accent transition leading-tight">{c.name}</div>
                      {c.providerCount > 0 && (
                        <div className="text-caption text-ink-tertiary mt-0.5">{c.providerCount.toLocaleString()} clinics</div>
                      )}
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-tertiary group-hover:text-brand-accent flex-shrink-0">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          )}

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
