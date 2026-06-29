import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { BrandDirectoryListing } from '@/components/shared/BrandDirectoryListing'
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

          {/* Clinic list with filters */}
          <div>
            {clinics.length > 0 && (
              <h2 className="font-serif text-h2 text-ink-primary mb-5">
                {totalClinics.toLocaleString()} {brand.name} clinic{totalClinics !== 1 ? 's' : ''} in {cityDisplay}
              </h2>
            )}
            <BrandDirectoryListing
              clinics={clinics}
              serviceOptions={relatedServices.map((s) => ({ id: String(s.id), name: s.name }))}
              emptyMessage={`No clinics found for ${brand.name} in ${cityDisplay} yet.`}
              emptyLink={{ href: `/brands/${brand.slug}`, label: `Browse all ${brand.name} clinics` }}
              brandSlug={brand.slug}
              stateSlug={stateLocation?.slug}
              citySlug={city.slug}
              totalClinics={totalClinics}
            />
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
