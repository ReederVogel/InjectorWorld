'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { DirectoryClinicCard } from '@/components/shared/DirectoryClinicCard'
import { ListingFilters } from '@/components/shared/ListingFilters'
import {
  DEFAULT_LISTING_FILTERS,
  applyListingFilters,
  type ListingFilterValues,
} from '@/components/shared/applyListingFilters'
import type { CityHubData } from '@/lib/location-queries'
import { distinctNeighborhoods, matchesNeighborhood } from '@/lib/neighborhood-filter'

const CLINIC_PAGE_SIZE = 24

type Props = { data: CityHubData; schema: object[] }

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

export function CityHubPage({ data, schema }: Props) {
  const { city, stateLocation, services: treatments, brands, clinics, neighborhoods, faqs, totalClinics } = data
  const cityDisplay = city.name.replace(/\s+city$/i, '')
  const [neighborhood, setNeighborhood] = useState('')
  const [listingFilters, setListingFilters] = useState<ListingFilterValues>(DEFAULT_LISTING_FILTERS)
  const [allClinics, setAllClinics] = useState(clinics)
  const [clinicPage, setClinicPage] = useState(1)
  const [isClinicLoading, setIsClinicLoading] = useState(false)
  const [clinicLoadError, setClinicLoadError] = useState<string | null>(null)

  const listingClinics = useMemo(
    () => applyListingFilters(allClinics, listingFilters, 'clinic').items,
    [allClinics, listingFilters],
  )
  const filteredClinics = useMemo(
    () => listingClinics.filter((c) => matchesNeighborhood(c.neighborhood, neighborhood)),
    [listingClinics, neighborhood],
  )
  const neighborhoodOptions = useMemo(
    () => distinctNeighborhoods([
      ...neighborhoods.map((n) => n.name),
      ...allClinics.map((c) => c.neighborhood),
    ]),
    [allClinics, neighborhoods],
  )

  useEffect(() => {
    setAllClinics(clinics)
    setClinicPage(1)
    setClinicLoadError(null)
  }, [clinics, city.slug])

  const hasMoreClinics = allClinics.length < totalClinics
  const remainingClinics = Math.max(0, totalClinics - allClinics.length)

  async function loadMoreClinics() {
    if (!stateLocation || isClinicLoading || !hasMoreClinics) return

    setIsClinicLoading(true)
    setClinicLoadError(null)

    const nextPage = clinicPage + 1
    try {
      const res = await fetch(
        `/api/city-clinics?stateSlug=${encodeURIComponent(stateLocation.slug)}&citySlug=${encodeURIComponent(city.slug)}&page=${nextPage}&limit=${CLINIC_PAGE_SIZE}`,
      )
      if (!res.ok) throw new Error('Unable to load more clinics.')

      const json = await res.json() as { clinics?: CityHubData['clinics'] }
      const nextClinics = Array.isArray(json.clinics) ? json.clinics : []

      setAllClinics((prev) => {
        const seen = new Set(prev.map((clinic) => clinic.id))
        return [...prev, ...nextClinics.filter((clinic) => !seen.has(clinic.id))]
      })
      setClinicPage(nextPage)
    } catch {
      setClinicLoadError('Could not load more clinics. Please try again.')
    } finally {
      setIsClinicLoading(false)
    }
  }

  return (
    <>
      {schema.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s).replace(/</g, '\\u003c') }} />
      ))}

      {/* Navy hero band */}
      <section className="bg-[#0B1B34] text-white pt-16 pb-12">
        <div className="max-canvas">
          <nav className="flex items-center gap-2 text-caption text-white/50 mb-6" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-white/80 transition">Home</Link>
            <span>/</span>
            {stateLocation && (
              <>
                <Link href={`/${stateLocation.slug}`} className="hover:text-white/80 transition">{stateLocation.name}</Link>
                <span>/</span>
              </>
            )}
            <span className="text-white/80">{city.name}</span>
          </nav>

          <p className="text-overline uppercase tracking-widest text-brand-accent mb-3 font-semibold">
            {stateLocation?.name ?? city.stateCode}
          </p>
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight mb-4">
            Find clinics in {cityDisplay}
          </h1>
          <p className="font-serif text-lede-m md:text-lede text-white/70 max-w-[600px]">
            {totalClinics > 0
              ? `${totalClinics} verified aesthetic clinics in ${cityDisplay}. Choose a service or browse all below.`
              : `Browse verified aesthetic clinics in ${cityDisplay}. Choose a service to get started.`}
          </p>
        </div>
      </section>

      {/* Service + Brand picker chips */}
      {(treatments.length > 0 || brands.length > 0) && (
        <section className="bg-[#0B1B34] pb-8">
          <div className="max-canvas space-y-5">
            {treatments.length > 0 && (
              <div>
                <p className="text-caption text-white/50 uppercase tracking-widest font-semibold mb-3">Browse by service</p>
                <div className="flex flex-wrap gap-2">
                  {treatments.map((t) => (
                    <Link
                      key={t.id}
                      href={stateLocation ? `/services/${t.slug}/${stateLocation.slug}/${city.slug}` : `/services/${t.slug}`}
                      className="px-4 py-2 rounded-pill bg-white/10 text-white text-body-sm font-medium hover:bg-white hover:text-ink-primary transition"
                    >
                      {t.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {brands.length > 0 && (
              <div>
                <p className="text-caption text-white/50 uppercase tracking-widest font-semibold mb-3">Browse by brand</p>
                <div className="flex flex-wrap gap-2">
                  {brands.map((b) => (
                    <Link
                      key={b.id}
                      href={stateLocation ? `/brands/${b.slug}/${stateLocation.slug}/${city.slug}` : `/brands/${b.slug}`}
                      className="px-4 py-2 rounded-pill border border-white/20 text-white text-body-sm font-medium hover:bg-white hover:text-ink-primary transition"
                    >
                      {b.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <div className="section-pad bg-surface-canvas">
        <div className="max-canvas space-y-14">
          <div className="md:flex md:items-start md:gap-6">
            <ListingFilters
              items={allClinics}
              mode="clinics"
              resultCount={filteredClinics.length}
              totalCount={allClinics.length}
              onChange={setListingFilters}
              brandOptions={brands.map((b) => ({ id: b.id, name: b.name }))}
              serviceOptions={treatments.map((t) => ({ id: t.id, name: t.name }))}
            />

            <div className="min-w-0 flex-1 space-y-14 pb-20 md:pb-0">
              {neighborhoodOptions.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-caption text-ink-tertiary uppercase tracking-wider">Neighborhood</span>
                  <select
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    className="px-3 py-2 rounded-pill border border-border text-body-sm text-ink-primary bg-surface-canvas focus:outline-none focus:border-brand-accent cursor-pointer"
                    aria-label="Filter by neighborhood"
                  >
                    <option value="">All neighborhoods</option>
                    {neighborhoodOptions.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Top Clinics */}
              {filteredClinics.length > 0 ? (
                <div>
                  <div className="flex items-baseline justify-between mb-6">
                    <h2 className="font-serif text-h2 text-ink-primary">Top clinics in {cityDisplay}</h2>
                    <Link href="/clinics" className="text-body-sm text-brand-accent font-medium hover:underline flex items-center gap-1">
                      View all
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredClinics.map((c) => (
                      <DirectoryClinicCard key={c.id} c={c} />
                    ))}
                  </div>
                  {clinicLoadError && (
                    <p className="mt-4 text-body-sm text-red-700 text-center" role="status">
                      {clinicLoadError}
                    </p>
                  )}
                  {hasMoreClinics && (
                    <div className="mt-6 text-center">
                      <button
                        type="button"
                        onClick={loadMoreClinics}
                        disabled={isClinicLoading}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-pill border border-border text-body-sm font-medium text-ink-primary hover:border-brand-accent hover:bg-surface transition disabled:opacity-50"
                      >
                        {isClinicLoading ? 'Loading...' : `Load more clinics (${remainingClinics} remaining)`}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-surface p-8 text-center">
                  <p className="text-body text-ink-secondary">No clinics match your filters.</p>
                  <button
                    type="button"
                    onClick={() => setNeighborhood('')}
                    className="mt-3 text-brand-accent text-body-sm hover:underline"
                  >
                    Clear neighborhood
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* State link */}
          {stateLocation && (
            <div className="rounded-2xl border border-border bg-surface p-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="font-semibold text-body text-ink-primary">All clinics in {stateLocation.name}</div>
                  <div className="text-body-sm text-ink-secondary mt-0.5">Compare cities and services statewide.</div>
                </div>
                <Link href={`/${stateLocation.slug}`} className="flex items-center gap-1.5 text-body-sm text-brand-accent font-medium hover:underline flex-shrink-0">
                  Browse {stateLocation.name}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                </Link>
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
