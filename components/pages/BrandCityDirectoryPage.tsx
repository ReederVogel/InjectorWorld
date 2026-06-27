import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import type { BrandCityData } from '@/lib/brand-queries'

type Props = { data: BrandCityData; schema: object[] }

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

export function BrandCityDirectoryPage({ data, schema }: Props) {
  const { brand, city, stateLocation, clinics, relatedServices, faqs, totalClinics } = data
  const cityDisplay = city.name.replace(/\s+city$/i, '')

  return (
    <>
      {schema.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s).replace(/</g, '\\u003c') }} />
      ))}

      <Header />

      {/* Breadcrumb */}
      <div className="bg-surface border-b border-border">
        <div className="max-canvas py-3">
          <nav className="flex items-center gap-2 text-caption text-ink-tertiary flex-wrap" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-ink-primary transition">Home</Link>
            <span>/</span>
            <Link href="/brands" className="hover:text-ink-primary transition">Brands</Link>
            <span>/</span>
            <Link href={`/brands/${brand.slug}`} className="hover:text-ink-primary transition">{brand.name}</Link>
            {stateLocation && (
              <>
                <span>/</span>
                <Link href={`/brands/${brand.slug}/${stateLocation.slug}`} className="hover:text-ink-primary transition">{stateLocation.name}</Link>
              </>
            )}
            <span>/</span>
            <span className="text-ink-primary">{cityDisplay}</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="bg-surface-canvas pt-10 pb-8 border-b border-border">
        <div className="max-canvas">
          <span className="text-overline uppercase tracking-widest font-semibold text-brand-accent mb-3 block">
            {brand.name} in {cityDisplay}
          </span>
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-3">
            {brand.name} Clinics in {cityDisplay}, {city.stateCode}
          </h1>
          <p className="text-body-lg text-ink-secondary max-w-2xl">
            {totalClinics > 0
              ? `${totalClinics.toLocaleString()} verified clinics carrying ${brand.name} in ${cityDisplay}. All license-checked and patient-reviewed.`
              : `Find verified clinics carrying ${brand.name} in ${cityDisplay}. All license-checked and patient-reviewed.`}
          </p>

          {/* Related services filter chips */}
          {relatedServices.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-5">
              <span className="text-caption text-ink-tertiary uppercase tracking-wider font-semibold self-center">Also browse:</span>
              {relatedServices.slice(0, 6).map((s) => (
                <Link
                  key={s.id}
                  href={`/services/${s.slug}`}
                  className="px-3 py-1.5 rounded-pill border border-border text-body-sm text-ink-secondary hover:border-brand-accent hover:text-brand-accent transition"
                >
                  {s.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="section-pad bg-surface-canvas">
        <div className="max-canvas space-y-12">

          {/* Clinic list */}
          {clinics.length > 0 ? (
            <div>
              <h2 className="font-serif text-h2 text-ink-primary mb-5">
                {totalClinics.toLocaleString()} {brand.name} clinic{totalClinics !== 1 ? 's' : ''} in {cityDisplay}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                {clinics.map((c) => (
                  <Link
                    key={c.id}
                    href={`/clinics/${c.slug}`}
                    className="group flex flex-col p-5 rounded-xl border border-border bg-surface hover:border-brand-accent hover:shadow-hover hover:-translate-y-[2px] transition-all duration-200"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <h3 className="font-semibold text-body text-ink-primary group-hover:text-brand-accent transition leading-tight">
                        {c.clinicName}
                      </h3>
                      {c.aggregateRating && (
                        <span className="flex-shrink-0 flex items-center gap-1 text-caption font-semibold text-state-star">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                          {c.aggregateRating.toFixed(1)}
                          {c.aggregateRatingCount && <span className="text-ink-tertiary font-normal">({c.aggregateRatingCount.toLocaleString()})</span>}
                        </span>
                      )}
                    </div>
                    <p className="text-body-sm text-ink-secondary mb-3">
                      {c.city}, {c.state}
                      {c.neighborhood && ` · ${c.neighborhood}`}
                    </p>
                    {c.tagline && (
                      <p className="text-body-sm text-ink-tertiary line-clamp-2 mb-3">{c.tagline}</p>
                    )}
                    <span className="mt-auto flex items-center gap-1.5 text-body-sm text-brand-accent font-medium">
                      View clinic
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-body text-ink-secondary mb-3">No clinics found for {brand.name} in {cityDisplay} yet.</p>
              <Link href={`/brands/${brand.slug}`} className="text-brand-accent hover:underline text-body-sm">
                Browse all {brand.name} clinics
              </Link>
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

          {/* Internal links */}
          <div className="flex flex-wrap gap-3">
            <Link href={`/brands/${brand.slug}`} className="flex items-center gap-1.5 text-body-sm text-brand-accent hover:underline">
              All {brand.name} clinics
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </Link>
            {stateLocation && (
              <Link href={`/brands/${brand.slug}/${stateLocation.slug}`} className="flex items-center gap-1.5 text-body-sm text-brand-accent hover:underline">
                {brand.name} in {stateLocation.name}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
            )}
            <Link href={`/${stateLocation?.slug ?? ''}`} className="flex items-center gap-1.5 text-body-sm text-brand-accent hover:underline">
              All clinics in {cityDisplay}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </>
  )
}
