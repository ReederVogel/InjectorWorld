import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { ProviderFilters } from '@/components/shared/ProviderFilters'
import { SponsoredProviderCard } from '@/components/shared/SponsoredProviderCard'
import type { CityDirectoryData } from '@/lib/location-queries'
import type { SponsoredProvider } from '@/lib/promotion-queries'

type Props = {
  data: CityDirectoryData
  sponsored: SponsoredProvider[]
  schema: object[]
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

export function CityDirectoryPage({ data, sponsored, schema }: Props) {
  const { treatment, city, stateLocation, providers, neighborhoods, faqs } = data
  const stateCode = city.stateCode
  const cityDisplayName = city.name.replace(/\s+city$/i, '')

  const breadcrumbItems = [
    { href: '/', label: 'Home' },
    ...(stateLocation ? [{ href: `/${stateLocation.slug}`, label: stateLocation.name }] : []),
    ...(stateLocation ? [{ href: `/${treatment.slug}/${stateLocation.slug}`, label: `${treatment.name} in ${stateLocation.name}` }] : []),
    { label: city.name },
  ]

  return (
    <>
      {schema.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
      ))}

      <Header />

      {/* Breadcrumb */}
      <div className="bg-surface border-b border-border">
        <div className="max-canvas py-3">
          <nav className="flex items-center gap-2 text-caption text-ink-tertiary flex-wrap" aria-label="Breadcrumb">
            {breadcrumbItems.map((item, i) => (
              <span key={i} className="flex items-center gap-2">
                {i > 0 && <span>/</span>}
                {item.href ? (
                  <Link href={item.href} className="hover:text-ink-primary transition">{item.label}</Link>
                ) : (
                  <span className="text-ink-primary">{item.label}</span>
                )}
              </span>
            ))}
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="bg-surface-canvas pt-10 pb-8 border-b border-border">
        <div className="max-canvas">
          <span className="text-overline uppercase tracking-widest font-semibold text-brand-accent mb-3 block">
            {treatment.name} Directory
          </span>
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-3">
            {treatment.name} in {cityDisplayName}, {stateCode}
          </h1>
          <p className="text-body-lg text-ink-secondary max-w-2xl">
            {providers.length > 0
              ? `${providers.length} verified ${treatment.name} provider${providers.length !== 1 ? 's' : ''} in ${cityDisplayName}. License-verified, patient-reviewed, no paid rankings.`
              : `Find verified ${treatment.name} providers in ${cityDisplayName}. Every injector is license-checked and patient-reviewed.`}
          </p>

          {/* Quick stats */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 text-body-sm text-ink-secondary">
            <span className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--brand-accent))" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              License verified
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--brand-accent))" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Real patient reviews
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--brand-accent))" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Zero paid rankings
            </span>
          </div>
        </div>
      </section>

      <div className="section-pad bg-surface-canvas">
        <div className="max-canvas">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-10 lg:gap-14 items-start">

            {/* Main column */}
            <div>
              {/* Sponsored cards */}
              {sponsored.length > 0 && (
                <div className="mb-8">
                  <p className="text-caption text-ink-tertiary font-medium uppercase tracking-widest mb-3">Sponsored</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {sponsored.map((p) => (
                      <SponsoredProviderCard key={p.id} provider={p} />
                    ))}
                  </div>
                  <hr className="mt-6 border-border" />
                </div>
              )}

              {/* Filters + map + provider grid (client component) */}
              <ProviderFilters providers={providers} />

              {/* Neighborhood quick-links */}
              {neighborhoods.length > 0 && (
                <div className="mt-12">
                  <h2 className="font-serif text-h3 text-ink-primary mb-4">Browse by neighborhood</h2>
                  <div className="flex flex-wrap gap-2">
                    {neighborhoods.map((n) => (
                      <Link
                        key={n.id}
                        href={`/${treatment.slug}/${city.slug}/${n.slug}`}
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

              {/* FAQs */}
              {faqs.length > 0 && (
                <div className="mt-12">
                  <h2 className="font-serif text-h3 text-ink-primary mb-5">Frequently asked questions</h2>
                  <div className="space-y-2">
                    {faqs.map((f) => <FaqItem key={f.id} question={f.question} answer={f.answer} />)}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-5 lg:sticky lg:top-24">
              {/* Internal links */}
              <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
                <h3 className="text-h4 text-ink-primary">Explore more</h3>
                <Link href={`/${treatment.slug}`} className="flex items-center justify-between text-body-sm text-ink-secondary hover:text-brand-accent transition py-1">
                  <span>All {treatment.name} providers</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                </Link>
                {stateLocation && (
                  <Link href={`/${treatment.slug}/${stateLocation.slug}`} className="flex items-center justify-between text-body-sm text-ink-secondary hover:text-brand-accent transition py-1">
                    <span>{treatment.name} in {stateLocation.name}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                  </Link>
                )}
                {stateLocation && (
                  <Link href={`/${stateLocation.slug}`} className="flex items-center justify-between text-body-sm text-ink-secondary hover:text-brand-accent transition py-1">
                    <span>All injectors in {stateLocation.name}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                  </Link>
                )}
              </div>

              {/* Read the guide */}
              {treatment.slug && (
                <div className="rounded-2xl border border-border bg-surface-warm p-5">
                  <div className="text-overline uppercase tracking-widest font-semibold text-brand-accent mb-2">Treatment guide</div>
                  <h3 className="font-serif text-h3 text-ink-primary mb-2 leading-snug">{treatment.name}: The Complete Guide</h3>
                  {treatment.tagline && <p className="text-body-sm text-ink-secondary mb-4">{treatment.tagline}</p>}
                  <Link href={`/guides/${treatment.slug}`} className="flex items-center gap-1.5 text-body-sm text-brand-accent font-medium hover:underline">
                    Read the guide
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                  </Link>
                </div>
              )}

              {/* Trust */}
              <div className="rounded-xl border border-border-subtle bg-surface p-4 text-caption text-ink-tertiary leading-relaxed">
                Every provider on injector.world is license-verified against the state medical board.
                <Link href="/how-we-verify" className="block mt-1 text-brand-accent hover:underline">How we verify</Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </>
  )
}
