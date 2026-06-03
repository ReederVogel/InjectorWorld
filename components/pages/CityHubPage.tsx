import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { SponsoredProviderCard } from '@/components/shared/SponsoredProviderCard'
import type { CityHubData } from '@/lib/location-queries'
import type { SponsoredProvider } from '@/lib/promotion-queries'

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
  const { city, stateLocation, treatments, neighborhoods, faqs } = data
  const cityDisplay = city.name.replace(/\s+city$/i, '')

  return (
    <>
      {schema.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
      ))}

      <Header />

      {/* Breadcrumb */}
      <div className="bg-surface border-b border-border">
        <div className="max-canvas py-3">
          <nav className="flex items-center gap-2 text-caption text-ink-tertiary" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-ink-primary transition">Home</Link>
            <span>/</span>
            {stateLocation && (
              <>
                <Link href={`/${stateLocation.slug}`} className="hover:text-ink-primary transition">{stateLocation.name}</Link>
                <span>/</span>
              </>
            )}
            <span className="text-ink-primary">{city.name}</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="bg-surface-canvas pt-10 pb-8 border-b border-border">
        <div className="max-canvas">
          <span className="text-overline uppercase tracking-widest font-semibold text-brand-accent mb-3 block">
            City Directory
          </span>
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-3">
            Aesthetic injectors in {cityDisplay}, {city.stateCode}
          </h1>
          <p className="text-body-lg text-ink-secondary max-w-2xl">
            Browse {city.providerCount > 0 ? `${city.providerCount.toLocaleString()}+` : 'verified'} aesthetic providers in {cityDisplay}. Choose a treatment below to see license-verified injectors near you.
          </p>
        </div>
      </section>

      <div className="section-pad bg-surface-canvas">
        <div className="max-canvas space-y-14">

          {/* Sponsored */}
          {sponsored.length > 0 && (
            <div>
              <p className="text-caption text-ink-tertiary font-medium uppercase tracking-widest mb-3">Sponsored</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {sponsored.map((p) => <SponsoredProviderCard key={p.id} provider={p} />)}
              </div>
            </div>
          )}

          {/* Treatments grid */}
          <div>
            <h2 className="font-serif text-h2 text-ink-primary mb-6">Browse by treatment in {cityDisplay}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {treatments.map((t) => (
                <Link
                  key={t.id}
                  href={`/${t.slug}/${city.slug}`}
                  className="group flex flex-col p-4 rounded-xl border border-border bg-surface hover:border-brand-accent hover:bg-surface-warm transition-all"
                >
                  <span className="font-medium text-body-sm text-ink-primary group-hover:text-brand-accent transition leading-tight">{t.name}</span>
                  {t.tagline && <span className="text-caption text-ink-tertiary mt-1 leading-snug line-clamp-2">{t.tagline}</span>}
                  <span className="mt-auto pt-2 flex items-center gap-1 text-caption text-brand-accent font-medium">
                    Find providers
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Neighborhoods */}
          {neighborhoods.length > 0 && (
            <div>
              <h2 className="font-serif text-h2 text-ink-primary mb-4">Browse by neighborhood</h2>
              <div className="flex flex-wrap gap-2">
                {neighborhoods.map((n) => (
                  <span key={n.id} className="px-4 py-2 rounded-pill border border-border text-body-sm text-ink-secondary">
                    {n.name}
                  </span>
                ))}
              </div>
              <p className="text-caption text-ink-tertiary mt-3">Choose a treatment above to filter by neighborhood.</p>
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

      <Footer />
    </>
  )
}
