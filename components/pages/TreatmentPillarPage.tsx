import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { TreatmentDirectory } from '@/components/pages/TreatmentDirectory'
import { PromoBanner } from '@/components/shared/PromoBanner'
import { TreatmentIndices } from '@/components/shared/TreatmentIndices'
import { WorthItBadge } from '@/components/shared/WorthItBadge'
import { CostEstimator } from '@/components/shared/CostEstimator'
import { RelatedQAs } from '@/components/shared/RelatedQAs'
import { StateCityPicker } from '@/components/shared/StateCityPicker'
import { IpStateHint } from '@/components/shared/IpStateHint'
import type { TreatmentPillarData } from '@/lib/location-queries'
import type { ActiveBanner } from '@/lib/promotions'

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
  const { treatment, guide, topCities, treatmentProviders, treatmentClinics, faqs, worthIt, relatedQAs, states, allCities } = data

  return (
    <>
      {schema.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s).replace(/</g, '\\u003c') }} />
      ))}

      <Header />

      {/* Ad banner */}
      <PromoBanner banner={banner} />

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

          {/* Find a provider — state + city picker */}
          <div>
            <IpStateHint treatmentSlug={treatment.slug} states={states} />
            <StateCityPicker
              treatmentSlug={treatment.slug}
              treatmentName={treatment.name}
              states={states}
              allCities={allCities}
            />
            {/* SSR city links for search engine crawling */}
            {topCities.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <span className="text-caption text-ink-tertiary font-medium uppercase tracking-wider shrink-0">
                  Popular:
                </span>
                {topCities.slice(0, 8).map(c => (
                  <Link
                    key={c.id}
                    href={`/${treatment.slug}/${c.slug}`}
                    className="text-body-sm text-ink-secondary hover:text-brand-accent transition"
                  >
                    {c.name}
                    {c.providerCount > 0 && (
                      <span className="text-ink-tertiary ml-1">({c.providerCount}+)</span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Directory: Injectors + Clinics tabs */}
          <div>
            <h2 className="font-serif text-h2 text-ink-primary mb-2">
              Find a {treatment.name} provider near you
            </h2>
            <p className="text-body text-ink-secondary mb-8">
              Select your city above to filter by location, or browse all verified providers below.
            </p>
            <TreatmentDirectory
              providers={treatmentProviders}
              clinics={treatmentClinics}
              treatmentName={treatment.name}
            />
          </div>

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
