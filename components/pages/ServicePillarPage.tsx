import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { ServiceDirectory } from '@/components/pages/ServiceDirectory'
import { ZipPromoBanner } from '@/components/shared/ZipPromoBanner'
import { ServiceIndices } from '@/components/shared/ServiceIndices'
import { WorthItBadge } from '@/components/shared/WorthItBadge'
import { CostEstimator } from '@/components/shared/CostEstimator'
import { RelatedQAs } from '@/components/shared/RelatedQAs'
import { LocationPicker } from '@/components/shared/LocationPicker'
import { IpStateHint } from '@/components/shared/IpStateHint'
import { CountPill } from '@/components/shared/CountPill'
import { FaqAccordionItem } from '@/components/shared/FaqAccordionItem'
import type { ServicePillarData } from '@/lib/location-queries'
import type { ActiveBanner } from '@/lib/promotions'

type Props = { data: ServicePillarData; banner: ActiveBanner | null; schema: object[] }


const BODY_AREA_LABEL: Record<string, string> = {
  forehead: 'Forehead', brow: 'Brow', 'under-eye': 'Under Eye',
  'crows-feet': "Crow's Feet", cheeks: 'Cheeks', lips: 'Lips',
  chin: 'Chin', jawline: 'Jawline', neck: 'Neck', decolletage: 'Décolletage',
}

export function ServicePillarPage({ data, banner, schema }: Props) {
  const { service, guide, topCities, serviceClinics, faqs, worthIt, relatedQAs, states, allCities, relatedBrands, totalClinics } = data

  return (
    <>
      {schema.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s).replace(/</g, '\\u003c') }} />
      ))}

      <Header />

      {/* Ad banner */}
      <ZipPromoBanner fallback={banner} serviceId={data.service?.id ? String(data.service.id) : undefined} />

      {/* Breadcrumb */}
      <div className="bg-surface border-b border-border">
        <div className="max-canvas py-3">
          <nav className="flex items-center gap-2 text-caption text-ink-tertiary" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-ink-primary transition">Home</Link>
            <span>/</span>
            <span className="text-ink-primary">{service.name}</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="bg-surface-warm pt-12 pb-10 md:pt-16 md:pb-12">
        <div className="max-canvas max-w-4xl">
          <span className="text-overline uppercase tracking-widest font-semibold text-brand-accent mb-4 block">
            {service.category.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
          </span>
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-4">
            {service.name} Injectors
          </h1>
          {service.tagline && (
            <p className="font-serif text-lede-m md:text-lede text-ink-secondary mb-6">{service.tagline}</p>
          )}
          {service.shortDescription && (
            <p className="text-body-lg text-ink-secondary max-w-2xl">{service.shortDescription}</p>
          )}

          {/* Meta pills */}
          {totalClinics > 0 && (
            <div className="flex flex-wrap gap-3 mt-6">
              <CountPill count={totalClinics} label="verified clinics" />
            </div>
          )}

          {/* Price range */}
          {service.avgPriceFromUsd && service.avgPriceToUsd && (
            <div className="flex items-center gap-2 mt-6">
              <span className="text-caption text-ink-tertiary uppercase tracking-wider font-semibold">Avg. cost</span>
              <span className="font-semibold text-body text-ink-primary">
                ${service.avgPriceFromUsd.toLocaleString()} to ${service.avgPriceToUsd.toLocaleString()}
              </span>
              {service.priceUnit && (
                <span className="text-caption text-ink-tertiary">{service.priceUnit.replace(/_/g, ' ')}</span>
              )}
            </div>
          )}

          {/* Worth-It + Service indices */}
          <div className="flex flex-wrap items-start gap-4 mt-6">
            <WorthItBadge result={worthIt} serviceName={service.name} />
            <ServiceIndices
              painIndex={service.painIndex}
              longevityLabel={service.longevityLabel}
              downtimeLabel={service.downtimeLabel}
            />
          </div>

          {/* Body areas */}
          {service.bodyAreas.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {service.bodyAreas.map((area) => (
                <span
                  key={area}
                  className="px-3 py-1.5 rounded-control border border-border text-body-sm text-ink-secondary"
                >
                  {BODY_AREA_LABEL[area] ?? area}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="section-pad bg-surface-canvas">
        <div className="max-canvas space-y-16">

          {/* Find a provider: state + city picker */}
          <div>
            <IpStateHint serviceSlug={service.slug} states={states} />
            <LocationPicker
              heading={`Find a ${service.name} provider near you`}
              states={states}
              allCities={allCities.map((c) => ({
                name: c.name, slug: c.slug, stateCode: c.stateCode, stateSlug: c.stateSlug, count: c.providerCount,
              }))}
              countLabel="clinics"
              basePath={`/services/${service.slug}`}
            />
            {/* SSR city links for search engine crawling */}
            {topCities.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <span className="text-caption text-ink-tertiary font-medium uppercase tracking-wider shrink-0">
                  Popular:
                </span>
                {topCities.slice(0, 8).filter(c => c.stateSlug).map(c => (
                  <Link
                    key={c.id}
                    href={`/services/${service.slug}/${c.stateSlug}/${c.slug}`}
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

          {/* Directory: verified clinics offering this service */}
          <div>
            <h2 className="font-serif text-h2 text-ink-primary mb-2">
              Find a {service.name} clinic near you
            </h2>
            <p className="text-body text-ink-secondary mb-8">
              Select your city above to filter by location, or browse all verified clinics below.
            </p>
            <ServiceDirectory
              clinics={serviceClinics}
              serviceName={service.name}
              serviceSlug={service.slug}
              totalClinics={totalClinics}
              brandOptions={relatedBrands}
            />
          </div>

          {/* Cost estimator */}
          {(service.avgPriceFromUsd || service.avgPriceToUsd) && (
            <CostEstimator
              serviceName={service.name}
              serviceSlug={service.slug}
              priceUnit={service.priceUnit}
              avgPriceFromUsd={service.avgPriceFromUsd}
              avgPriceToUsd={service.avgPriceToUsd}
            />
          )}

          {/* Risks note */}
          <div className="rounded-2xl border border-state-error/20 bg-state-error/5 p-6">
            <h2 className="font-serif text-h3 text-ink-primary mb-3">Risks and side effects</h2>
            <p className="text-body-sm text-ink-secondary leading-relaxed">
              {service.name} is generally considered safe when performed by a trained, licensed provider. Common side effects include temporary bruising, swelling, or redness at the injection site. Serious complications are rare but possible. Always consult a board-certified provider and disclose your full medical history before treatment.
            </p>
            {guide && (
              <Link href={`/guides/${guide.slug}`} className="inline-flex items-center gap-1.5 mt-3 text-body-sm text-brand-accent font-medium hover:underline">
                Read the full guide
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
            )}
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

          {/* Related Q&A */}
          <RelatedQAs qas={relatedQAs} serviceName={service.name} />

          {/* Guide CTA */}
          {guide && (
            <div className="rounded-2xl border border-border bg-surface-warm p-8 text-center">
              <h2 className="font-serif text-h2 text-ink-primary mb-3">{guide.title}</h2>
              <p className="text-body text-ink-secondary mb-6 max-w-xl mx-auto">{guide.lede}</p>
              <Link href={`/guides/${guide.slug}`}
                className="inline-flex items-center gap-2 bg-brand-primary text-surface-canvas rounded-control px-6 py-3 text-body-sm font-semibold hover:opacity-90 transition">
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
