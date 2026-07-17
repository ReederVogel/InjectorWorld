'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { DirectoryClinicCard } from '@/components/shared/DirectoryClinicCard'
import { ListingFilters } from '@/components/shared/ListingFilters'
import { StateCityCombobox } from '@/components/shared/StateCityCombobox'
import {
  DEFAULT_LISTING_FILTERS,
  applyListingFilters,
  type ListingFilterValues,
} from '@/components/shared/applyListingFilters'
import { sortClinicsByMerit } from '@/lib/merit'
import { CountPill } from '@/components/shared/CountPill'
import { FaqAccordionItem } from '@/components/shared/FaqAccordionItem'
import type { StateHubData } from '@/lib/location-queries'

type Props = { data: StateHubData; schema: object[] }

export function StateHubPage({ data, schema }: Props) {
  const { state, allCities, services: treatments, brands, clinics, faqs, totalClinics } = data
  const [listingFilters, setListingFilters] = useState<ListingFilterValues>(DEFAULT_LISTING_FILTERS)
  const [allClinics, setAllClinics] = useState(clinics)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const meritSortedClinics = useMemo(() => sortClinicsByMerit(allClinics), [allClinics])
  const filteredClinics = useMemo(
    () => applyListingFilters(meritSortedClinics, listingFilters, 'clinic').items,
    [meritSortedClinics, listingFilters],
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
            Clinic Directory
          </span>
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-3">
            Find a verified clinic in {state.name}
          </h1>
          <p className="flex flex-wrap items-center gap-2 text-body-lg text-ink-secondary max-w-2xl">
            {totalClinics > 0 && <CountPill count={totalClinics} label="verified clinics" />}
            <span>
              {totalClinics > 0
                ? `in ${state.name}. License-verified, patient-reviewed.`
                : `Browse license-verified Botox and aesthetic clinics across ${state.name}. Real patient reviews.`}
            </span>
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
                {treatments.map((t) => (
                  <Link
                    key={t.id}
                    href={`/services/${t.slug}/${state.slug}`}
                    className="flex-shrink-0 px-4 py-1.5 rounded-pill border border-border text-body-sm font-medium text-ink-secondary hover:border-brand-accent hover:text-brand-accent transition"
                  >
                    {t.name}
                  </Link>
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
          <div className="md:flex md:items-start md:gap-6">
            <ListingFilters
              items={allClinics}
              mode="clinics"
              resultCount={filteredClinics.length}
              totalCount={totalClinics}
              onChange={setListingFilters}
              brandOptions={brands.map((b) => ({ id: b.id, name: b.name }))}
              serviceOptions={treatments.map((t) => ({ id: t.id, name: t.name }))}
            />

            <div className="min-w-0 flex-1 space-y-14 pb-20 md:pb-0">
              {/* Top Clinics */}
              {filteredClinics.length > 0 ? (
                <div>
                  <h2 className="font-serif text-h2 text-ink-primary mb-6">Top Clinics in {state.name}</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                    {filteredClinics.map((c) => (
                      <DirectoryClinicCard key={c.id} c={c} />
                    ))}
                  </div>

                  {loadError && (
                    <p className="mt-4 text-body-sm text-state-error text-center" role="status">
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
              ) : (
                <div className="rounded-2xl border border-border bg-surface p-8 text-center">
                  <p className="text-body text-ink-secondary">No clinics match your filters.</p>
                </div>
              )}
            </div>
          </div>

          {/* FAQs */}
          {faqs.length > 0 && (
            <div>
              <h2 className="font-serif text-h2 text-ink-primary mb-5">Frequently asked questions</h2>
              <div className="space-y-2 max-w-3xl">
                {faqs.map((f) => (
                  <FaqAccordionItem
                    key={f.id}
                    question={f.question}
                    answer={f.answer}
                    detail={f.detail}
                    offLabel={f.offLabel}
                    safetyFlag={f.safetyFlag}
                    relatedGuideSlug={f.relatedGuideSlug}
                    relatedGuideTitle={f.relatedGuideTitle}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
