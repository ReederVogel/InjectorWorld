import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { BrandDirectoryListing } from '@/components/shared/BrandDirectoryListing'
import type { BrandPillarData } from '@/lib/brand-queries'

type Props = { data: BrandPillarData; schema: object[] }

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

export function BrandPillarPage({ data, schema }: Props) {
  const { brand, topClinics, states, relatedServices, faqs, totalClinics } = data

  const categoryLabel = {
    neurotoxin: 'Neurotoxin', filler: 'Filler', biostimulator: 'Biostimulator',
    skin: 'Skin', body: 'Body', other: '',
  }[brand.category] ?? brand.category

  return (
    <>
      {schema.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s).replace(/</g, '\\u003c') }} />
      ))}

      <Header />

      {/* Breadcrumb */}
      <div className="bg-surface border-b border-border">
        <div className="max-canvas py-3">
          <nav className="flex items-center gap-2 text-caption text-ink-tertiary" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-ink-primary transition">Home</Link>
            <span>/</span>
            <Link href="/brands" className="hover:text-ink-primary transition">Brands</Link>
            <span>/</span>
            <span className="text-ink-primary">{brand.name}</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="bg-surface-warm pt-12 pb-10 md:pt-16 md:pb-12 border-b border-border">
        <div className="max-canvas max-w-4xl">
          {categoryLabel && (
            <span className="text-overline uppercase tracking-widest font-semibold text-brand-accent mb-4 block">
              {categoryLabel}
            </span>
          )}
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-4">
            {brand.name} Clinics
          </h1>
          {brand.tagline && (
            <p className="font-serif text-lede-m md:text-lede text-ink-secondary mb-4">{brand.tagline}</p>
          )}
          {brand.shortDescription && (
            <p className="text-body-lg text-ink-secondary max-w-2xl">{brand.shortDescription}</p>
          )}

          {/* Meta pills */}
          <div className="flex flex-wrap gap-3 mt-6">
            {brand.manufacturer && (
              <span className="px-3 py-1.5 rounded-pill border border-border text-body-sm text-ink-secondary">
                By {brand.manufacturer}
              </span>
            )}
            {brand.longevityLabel && (
              <span className="px-3 py-1.5 rounded-pill border border-border text-body-sm text-ink-secondary">
                Lasts {brand.longevityLabel}
              </span>
            )}
            {brand.downtimeLabel && (
              <span className="px-3 py-1.5 rounded-pill border border-border text-body-sm text-ink-secondary">
                Downtime: {brand.downtimeLabel}
              </span>
            )}
            {totalClinics > 0 && (
              <span className="px-3 py-1.5 rounded-pill bg-brand-accent-soft text-brand-accent text-body-sm font-medium">
                {totalClinics.toLocaleString()} verified clinics
              </span>
            )}
          </div>

          {/* Pricing */}
          {brand.avgPriceFromUsd && brand.avgPriceToUsd && (
            <div className="flex items-center gap-2 mt-4">
              <span className="text-caption text-ink-tertiary uppercase tracking-wider font-semibold">Avg. cost</span>
              <span className="font-semibold text-body text-ink-primary">
                ${brand.avgPriceFromUsd.toLocaleString()} to ${brand.avgPriceToUsd.toLocaleString()}
              </span>
              {brand.priceUnit && (
                <span className="text-caption text-ink-tertiary">{brand.priceUnit.replace(/_/g, ' ')}</span>
              )}
            </div>
          )}
        </div>
      </section>

      <div className="section-pad bg-surface-canvas">
        <div className="max-canvas space-y-14">

          {/* Clinic listing with services filter */}
          <div>
            <div className="flex items-center justify-between gap-4 mb-5">
              <h2 className="font-serif text-h2 text-ink-primary">
                {totalClinics > 0
                  ? `${totalClinics.toLocaleString()} ${brand.name} clinic${totalClinics !== 1 ? 's' : ''}`
                  : `${brand.name} clinics`}
              </h2>
            </div>
            <BrandDirectoryListing
              clinics={topClinics}
              serviceOptions={relatedServices.map((s) => ({ id: s.id, name: s.name }))}
              emptyMessage={`No ${brand.name} clinics found yet.`}
            />
          </div>

          {/* Browse by state */}
          {states.length > 0 && (
            <div>
              <h2 className="font-serif text-h2 text-ink-primary mb-5">{brand.name} by state</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {states.map((s) => (
                  <Link
                    key={s.code}
                    href={`/brands/${brand.slug}/${s.slug}`}
                    className="group flex items-center justify-between p-4 rounded-xl border border-border bg-surface hover:border-brand-accent hover:bg-surface-warm transition-all"
                  >
                    <span className="font-medium text-body-sm text-ink-primary group-hover:text-brand-accent transition">{s.name}</span>
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

          {/* Guide CTA */}
          {brand.guide && (
            <div className="rounded-2xl border border-border bg-surface-warm p-8 text-center">
              <h2 className="font-serif text-h2 text-ink-primary mb-3">{brand.guide.title}</h2>
              <p className="text-body text-ink-secondary mb-6 max-w-xl mx-auto">{brand.guide.lede}</p>
              <Link
                href={`/guides/${brand.guide.slug}`}
                className="inline-flex items-center gap-2 bg-brand-primary text-surface-canvas rounded-pill px-6 py-3 text-body-sm font-semibold hover:opacity-90 transition"
              >
                Read the complete guide
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
            </div>
          )}

          {/* Website link */}
          {brand.websiteUrl && (
            <p className="text-body-sm text-ink-tertiary">
              Learn more at{' '}
              <a href={brand.websiteUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-brand-accent hover:underline">
                {brand.name} official site
              </a>
            </p>
          )}
        </div>
      </div>

      <Footer />
    </>
  )
}
