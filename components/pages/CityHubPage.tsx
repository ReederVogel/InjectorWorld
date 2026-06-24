'use client'

import { useState } from 'react'
import Link from 'next/link'
import { DirectoryProviderCard } from '@/components/shared/DirectoryProviderCard'
import { DirectoryClinicCard } from '@/components/shared/DirectoryClinicCard'
import type { CityHubData } from '@/lib/location-queries'
import type { SponsoredProvider } from '@/lib/promotions'

const PAGE = 12
const INCREMENT = 6

type Props = { data: CityHubData; sponsored: SponsoredProvider[]; schema: object[] }

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

export function CityHubPage({ data, sponsored, schema }: Props) {
  const { city, stateLocation, treatments, providers, clinics, neighborhoods, faqs } = data
  const cityDisplay = city.name.replace(/\s+city$/i, '')
  const [visibleCount, setVisibleCount] = useState(PAGE)

  const visibleProviders = providers.slice(0, visibleCount)
  const hasMore = providers.length > visibleCount

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
            Find injectors in {cityDisplay}
          </h1>
          <p className="font-serif text-lede-m md:text-lede text-white/70 max-w-[600px]">
            {providers.length > 0
              ? `${providers.length} verified aesthetic providers in ${cityDisplay}. Choose a treatment or browse all below.`
              : `Browse verified aesthetic providers and clinics in ${cityDisplay}. Choose a treatment to get started.`}
          </p>
        </div>
      </section>

      {/* Treatment picker chips */}
      {treatments.length > 0 && (
        <section className="bg-[#0B1B34] pb-8">
          <div className="max-canvas">
            <p className="text-caption text-white/50 uppercase tracking-widest font-semibold mb-3">Browse by treatment</p>
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
        </section>
      )}

      <div className="section-pad bg-surface-canvas">
        <div className="max-canvas space-y-14">

          {/* Sponsored */}
          {sponsored.length > 0 && (
            <div>
              <p className="text-caption text-ink-tertiary font-medium uppercase tracking-widest mb-3">Sponsored</p>
              <div className="flex sm:grid sm:grid-cols-2 md:grid-cols-3 gap-3 overflow-x-auto snap-x snap-mandatory -mx-5 px-5 sm:mx-0 sm:px-0 sm:overflow-x-visible pb-1 sm:pb-0">
                {sponsored.map((p) => (
                  <div key={p.id} className="flex-shrink-0 w-[78vw] max-w-[300px] snap-start sm:w-auto sm:max-w-none">
                    <DirectoryProviderCard provider={p} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Injectors */}
          {providers.length > 0 && (
            <div>
              <h2 className="font-serif text-h2 text-ink-primary mb-2">
                Top injectors in {cityDisplay}
              </h2>
              <p className="text-body-sm text-ink-secondary mb-6">
                License-verified providers in {cityDisplay}, ranked by rating, reviews, and profile completeness.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleProviders.map((p, i) => (
                  <DirectoryProviderCard key={p.id} provider={p} index={i} />
                ))}
              </div>
              {hasMore && (
                <div className="mt-8 text-center">
                  <button
                    onClick={() => setVisibleCount((n) => n + INCREMENT)}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-pill border border-border text-body-sm font-medium text-ink-primary hover:border-brand-accent hover:bg-surface transition"
                  >
                    Load more injectors
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Top Clinics */}
          {clinics.length > 0 && (
            <div>
              <div className="flex items-baseline justify-between mb-6">
                <h2 className="font-serif text-h2 text-ink-primary">Top clinics in {cityDisplay}</h2>
                <Link href="/clinics" className="text-body-sm text-brand-accent font-medium hover:underline flex items-center gap-1">
                  View all
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {clinics.slice(0, 6).map((c) => (
                  <DirectoryClinicCard key={c.id} c={c} />
                ))}
              </div>
            </div>
          )}

          {/* Browse by Neighborhood */}
          {neighborhoods.length > 0 && (
            <div>
              <h2 className="font-serif text-h2 text-ink-primary mb-4">Browse by neighborhood</h2>
              <div className="flex flex-wrap gap-2">
                {neighborhoods.map((n) => (
                  <Link
                    key={n.id}
                    href={stateLocation ? `/${stateLocation.slug}/${city.slug}/${n.slug}` : `/${city.slug}/${n.slug}`}
                    className="px-4 py-2 rounded-pill border border-border text-body-sm text-ink-secondary hover:border-brand-accent hover:text-brand-accent transition"
                  >
                    {n.name}
                    {n.providerCount > 0 && (
                      <span className="ml-1.5 text-ink-tertiary text-caption">{n.providerCount}+</span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* State link */}
          {stateLocation && (
            <div className="rounded-2xl border border-border bg-surface p-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="font-semibold text-body text-ink-primary">All injectors in {stateLocation.name}</div>
                  <div className="text-body-sm text-ink-secondary mt-0.5">Compare cities and treatments statewide.</div>
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
