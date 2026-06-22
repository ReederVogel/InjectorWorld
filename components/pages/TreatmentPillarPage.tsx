import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { DirectoryProviderCard } from '@/components/shared/DirectoryProviderCard'
import { AdBanner } from '@/components/shared/AdBanner'
import { TreatmentIndices } from '@/components/shared/TreatmentIndices'
import { WorthItBadge } from '@/components/shared/WorthItBadge'
import { CostEstimator } from '@/components/shared/CostEstimator'
import { RelatedQAs } from '@/components/shared/RelatedQAs'
import type { TreatmentPillarData } from '@/lib/location-queries'
import type { ActiveBanner } from '@/lib/promotion-queries'

type Props = { data: TreatmentPillarData; banner: ActiveBanner | null; schema: object[] }


const BODY_AREA_LABEL: Record<string, string> = {
  forehead: 'Forehead', brow: 'Brow', 'under-eye': 'Under Eye',
  'crows-feet': "Crow's Feet", cheeks: 'Cheeks', lips: 'Lips',
  chin: 'Chin', jawline: 'Jawline', neck: 'Neck', decolletage: 'Décolletage',
}

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

export function TreatmentPillarPage({ data, banner, schema }: Props) {
  const { treatment, guide, topCities, topProviders, faqs, worthIt, relatedQAs } = data

  return (
    <>
      {schema.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s).replace(/</g, '\\u003c') }} />
      ))}

      <Header />

      {/* Ad banner */}
      <AdBanner banner={banner} />

      {/* Breadcrumb */}
      <div className="bg-surface border-b border-border">
        <div className="max-canvas py-3">
          <nav className="flex items-center gap-2 text-caption text-ink-tertiary" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-ink-primary transition">Home</Link>
            <span>/</span>
            <span className="text-ink-primary">{treatment.name}</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="bg-surface-warm pt-12 pb-10 md:pt-16 md:pb-12">
        <div className="max-canvas max-w-4xl">
          <span className="text-overline uppercase tracking-widest font-semibold text-brand-accent mb-4 block">
            {treatment.category.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
          </span>
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-4">
            {treatment.name} Injectors
          </h1>
          {treatment.tagline && (
            <p className="font-serif text-lede-m md:text-lede text-ink-secondary mb-6">{treatment.tagline}</p>
          )}
          {treatment.shortDescription && (
            <p className="text-body-lg text-ink-secondary max-w-2xl">{treatment.shortDescription}</p>
          )}

          {/* Price range */}
          {treatment.avgPriceFromUsd && treatment.avgPriceToUsd && (
            <div className="flex items-center gap-2 mt-6">
              <span className="text-caption text-ink-tertiary uppercase tracking-wider font-semibold">Avg. cost</span>
              <span className="font-semibold text-body text-ink-primary">
                ${treatment.avgPriceFromUsd.toLocaleString()} to ${treatment.avgPriceToUsd.toLocaleString()}
              </span>
              {treatment.priceUnit && (
                <span className="text-caption text-ink-tertiary">{treatment.priceUnit.replace(/_/g, ' ')}</span>
              )}
            </div>
          )}

          {/* Worth-It + Treatment indices */}
          <div className="flex flex-wrap items-start gap-4 mt-6">
            <WorthItBadge result={worthIt} treatmentName={treatment.name} />
            <TreatmentIndices
              painIndex={treatment.painIndex}
              longevityLabel={treatment.longevityLabel}
              downtimeLabel={treatment.downtimeLabel}
            />
          </div>

          {/* Body areas */}
          {treatment.bodyAreas.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {treatment.bodyAreas.map((area) => (
                <Link
                  key={area}
                  href={`/treatments/${area}`}
                  className="px-3 py-1.5 rounded-pill border border-border text-body-sm text-ink-secondary hover:border-brand-accent hover:text-brand-accent transition"
                >
                  {BODY_AREA_LABEL[area] ?? area}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="section-pad bg-surface-canvas">
        <div className="max-canvas space-y-16">

          {/* Find a provider by city */}
          <div>
            <h2 className="font-serif text-h2 text-ink-primary mb-2">Find a {treatment.name} provider in your city</h2>
            <p className="text-body text-ink-secondary mb-6">Browse license-verified providers in the US's top aesthetic markets.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {topCities.map((c) => (
                <Link
                  key={c.id}
                  href={`/${treatment.slug}/${c.slug}`}
                  className="group flex items-center justify-between p-4 rounded-xl border border-border bg-surface hover:border-brand-accent hover:bg-surface-warm transition-all"
                >
                  <div>
                    <div className="font-medium text-body-sm text-ink-primary group-hover:text-brand-accent transition">{c.name}</div>
                    {c.providerCount > 0 && <div className="text-caption text-ink-tertiary">{c.providerCount.toLocaleString()}+</div>}
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-tertiary group-hover:text-brand-accent flex-shrink-0">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </Link>
              ))}
            </div>
          </div>

          {/* Top providers */}
          {topProviders.length > 0 && (
            <div>
              <h2 className="font-serif text-h2 text-ink-primary mb-6">Top picks: top {treatment.name} injectors</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {topProviders.map((p, i) => <DirectoryProviderCard key={p.id} provider={p} index={i} />)}
              </div>
            </div>
          )}

          {/* Cost estimator */}
          {(treatment.avgPriceFromUsd || treatment.avgPriceToUsd) && (
            <CostEstimator
              treatmentName={treatment.name}
              treatmentSlug={treatment.slug}
              priceUnit={treatment.priceUnit}
              avgPriceFromUsd={treatment.avgPriceFromUsd}
              avgPriceToUsd={treatment.avgPriceToUsd}
            />
          )}

          {/* Risks note */}
          <div className="rounded-2xl border border-state-error/20 bg-state-error/5 p-6">
            <h2 className="font-serif text-h3 text-ink-primary mb-3">Risks and side effects</h2>
            <p className="text-body-sm text-ink-secondary leading-relaxed">
              {treatment.name} is generally considered safe when performed by a trained, licensed provider. Common side effects include temporary bruising, swelling, or redness at the injection site. Serious complications are rare but possible. Always consult a board-certified provider and disclose your full medical history before treatment.
            </p>
            <Link href={`/guides/${treatment.slug}`} className="inline-flex items-center gap-1.5 mt-3 text-body-sm text-brand-accent font-medium hover:underline">
              Read the full guide
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </Link>
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

          {/* Related Q&A */}
          <RelatedQAs qas={relatedQAs} treatmentName={treatment.name} />

          {/* Guide CTA */}
          {guide && (
            <div className="rounded-2xl border border-border bg-surface-warm p-8 text-center">
              <h2 className="font-serif text-h2 text-ink-primary mb-3">{guide.title}</h2>
              <p className="text-body text-ink-secondary mb-6 max-w-xl mx-auto">{guide.lede}</p>
              <Link href={`/guides/${guide.slug}`}
                className="inline-flex items-center gap-2 bg-brand-primary text-surface-canvas rounded-pill px-6 py-3 text-body-sm font-semibold hover:opacity-90 transition">
                Read the complete guide
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </>
  )
}
