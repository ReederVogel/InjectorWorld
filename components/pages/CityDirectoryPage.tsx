import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { ProviderFilters } from '@/components/shared/ProviderFilters'
import { CityListingTabs } from '@/components/shared/CityListingTabs'
import { DirectoryClinicsView } from '@/components/shared/DirectoryClinicsView'
import { DirectoryProviderCard } from '@/components/shared/DirectoryProviderCard'
import { PromoBanner } from '@/components/shared/PromoBanner'
import { ComingSoonMarket } from '@/components/shared/ComingSoonMarket'
import { isMarketLive } from '@/lib/markets'
import type { CityDirectoryData } from '@/lib/location-queries'
import type { SponsoredProvider, ActiveBanner } from '@/lib/promotions'

type Props = {
  data: CityDirectoryData
  sponsored: SponsoredProvider[]
  banner: ActiveBanner | null
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

const NEARBY_FALLBACK: Record<string, { label: string; stateSlug: string; citySlug: string }> = {
  // East Coast + DC
  NY: { label: 'New York City', stateSlug: 'new-york', citySlug: 'new-york-city' },
  NJ: { label: 'New York City', stateSlug: 'new-york', citySlug: 'new-york-city' },
  CT: { label: 'New York City', stateSlug: 'new-york', citySlug: 'new-york-city' },
  MA: { label: 'Boston', stateSlug: 'massachusetts', citySlug: 'boston' },
  RI: { label: 'Boston', stateSlug: 'massachusetts', citySlug: 'boston' },
  NH: { label: 'Boston', stateSlug: 'massachusetts', citySlug: 'boston' },
  ME: { label: 'Boston', stateSlug: 'massachusetts', citySlug: 'boston' },
  VT: { label: 'Boston', stateSlug: 'massachusetts', citySlug: 'boston' },
  PA: { label: 'Philadelphia', stateSlug: 'pennsylvania', citySlug: 'philadelphia' },
  MD: { label: 'Washington DC', stateSlug: 'washington-dc', citySlug: 'washington' },
  VA: { label: 'Washington DC', stateSlug: 'washington-dc', citySlug: 'washington' },
  DC: { label: 'Washington DC', stateSlug: 'washington-dc', citySlug: 'washington' },
  // Southeast
  NC: { label: 'Charlotte', stateSlug: 'north-carolina', citySlug: 'charlotte' },
  SC: { label: 'Charlotte', stateSlug: 'north-carolina', citySlug: 'charlotte' },
  GA: { label: 'Atlanta', stateSlug: 'georgia', citySlug: 'atlanta' },
  FL: { label: 'Miami', stateSlug: 'florida', citySlug: 'miami' },
  AL: { label: 'Atlanta', stateSlug: 'georgia', citySlug: 'atlanta' },
  MS: { label: 'Atlanta', stateSlug: 'georgia', citySlug: 'atlanta' },
  TN: { label: 'Nashville', stateSlug: 'tennessee', citySlug: 'nashville' },
  KY: { label: 'Nashville', stateSlug: 'tennessee', citySlug: 'nashville' },
  // Midwest
  IL: { label: 'Chicago', stateSlug: 'illinois', citySlug: 'chicago' },
  IN: { label: 'Chicago', stateSlug: 'illinois', citySlug: 'chicago' },
  WI: { label: 'Chicago', stateSlug: 'illinois', citySlug: 'chicago' },
  MN: { label: 'Chicago', stateSlug: 'illinois', citySlug: 'chicago' },
  OH: { label: 'Chicago', stateSlug: 'illinois', citySlug: 'chicago' },
  MI: { label: 'Chicago', stateSlug: 'illinois', citySlug: 'chicago' },
  MO: { label: 'Chicago', stateSlug: 'illinois', citySlug: 'chicago' },
  IA: { label: 'Chicago', stateSlug: 'illinois', citySlug: 'chicago' },
  KS: { label: 'Chicago', stateSlug: 'illinois', citySlug: 'chicago' },
  NE: { label: 'Chicago', stateSlug: 'illinois', citySlug: 'chicago' },
  ND: { label: 'Chicago', stateSlug: 'illinois', citySlug: 'chicago' },
  SD: { label: 'Chicago', stateSlug: 'illinois', citySlug: 'chicago' },
  // South / Texas
  TX: { label: 'Dallas', stateSlug: 'texas', citySlug: 'dallas' },
  OK: { label: 'Dallas', stateSlug: 'texas', citySlug: 'dallas' },
  LA: { label: 'Houston', stateSlug: 'texas', citySlug: 'houston' },
  AR: { label: 'Dallas', stateSlug: 'texas', citySlug: 'dallas' },
  // West
  CA: { label: 'Los Angeles', stateSlug: 'california', citySlug: 'los-angeles' },
  OR: { label: 'Portland', stateSlug: 'oregon', citySlug: 'portland' },
  WA: { label: 'Seattle', stateSlug: 'washington', citySlug: 'seattle' },
  AZ: { label: 'Phoenix', stateSlug: 'arizona', citySlug: 'phoenix' },
  NV: { label: 'Las Vegas', stateSlug: 'nevada', citySlug: 'las-vegas' },
  CO: { label: 'Denver', stateSlug: 'colorado', citySlug: 'denver' },
  UT: { label: 'Denver', stateSlug: 'colorado', citySlug: 'denver' },
  ID: { label: 'Denver', stateSlug: 'colorado', citySlug: 'denver' },
  MT: { label: 'Denver', stateSlug: 'colorado', citySlug: 'denver' },
  WY: { label: 'Denver', stateSlug: 'colorado', citySlug: 'denver' },
  NM: { label: 'Phoenix', stateSlug: 'arizona', citySlug: 'phoenix' },
  HI: { label: 'Los Angeles', stateSlug: 'california', citySlug: 'los-angeles' },
  AK: { label: 'Seattle', stateSlug: 'washington', citySlug: 'seattle' },
}

function EmptyDirectoryState({
  treatmentName,
  treatmentSlug,
  cityName,
  citySlug,
  stateCode,
  stateLocation,
}: {
  treatmentName: string
  treatmentSlug: string
  cityName: string
  citySlug: string
  stateCode: string
  stateLocation: { slug: string; name: string } | null
}) {
  const fallbackCandidate = NEARBY_FALLBACK[stateCode]
  const fallback = fallbackCandidate?.citySlug !== citySlug ? fallbackCandidate : undefined
  return (
    <div className="rounded-2xl border border-border bg-surface p-8 text-center">
      <div className="w-14 h-14 rounded-full bg-brand-accent-soft flex items-center justify-center mx-auto mb-4">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--brand-accent))" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
      </div>
      <h2 className="font-serif text-h3 text-ink-primary mb-2">
        No verified providers listed in {cityName} yet
      </h2>
      <p className="text-body-sm text-ink-secondary max-w-md mx-auto mb-6">
        We are actively adding providers to this area. In the meantime, browse verified {treatmentName.toLowerCase()} injectors in nearby cities.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {stateLocation && (
          <Link
            href={`/${treatmentSlug}/${stateLocation.slug}`}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-pill bg-brand-primary text-surface-canvas text-body-sm font-semibold hover:opacity-90 transition"
          >
            Browse {stateLocation.name} providers
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
          </Link>
        )}
        {fallback && (
          <Link
            href={`/${treatmentSlug}/${fallback.stateSlug}/${fallback.citySlug}`}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-pill border border-border text-body-sm font-medium text-ink-primary hover:border-brand-accent hover:text-brand-accent transition"
          >
            {fallback.label} providers
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
          </Link>
        )}
        <Link
          href={`/${treatmentSlug}`}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-pill border border-border text-body-sm font-medium text-ink-secondary hover:border-brand-accent hover:text-ink-primary transition"
        >
          All {treatmentName} providers
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
        </Link>
      </div>
    </div>
  )
}

export function CityDirectoryPage({ data, sponsored, banner, schema }: Props) {
  const { treatment, city, stateLocation, providers, clinics, neighborhoods, faqs } = data
  const stateCode = city.stateCode
  const cityDisplayName = city.name.replace(/\s+city$/i, '')

  // Coming-soon market: city not live yet. Render waitlist instead of the
  // directory. Page is noindexed in generateMetadata.
  if (!isMarketLive(city)) {
    return (
      <>
        <Header />
        <div className="bg-surface border-b border-border">
          <div className="max-canvas py-3">
            <nav className="flex items-center gap-2 text-caption text-ink-tertiary flex-wrap" aria-label="Breadcrumb">
              <Link href="/" className="hover:text-ink-primary transition">Home</Link>
              {stateLocation && (
                <>
                  <span>/</span>
                  <Link href={`/${stateLocation.slug}`} className="hover:text-ink-primary transition">{stateLocation.name}</Link>
                </>
              )}
              <span>/</span>
              <span className="text-ink-primary">{city.name}</span>
            </nav>
          </div>
        </div>
        <ComingSoonMarket
          overline={`${treatment.name} · Coming soon`}
          title={`${treatment.name} in ${cityDisplayName}, ${stateCode}`}
          placeName={cityDisplayName}
          cityTag={cityDisplayName}
          stateCode={stateCode}
          links={[
            { href: `/${treatment.slug}`, label: `All ${treatment.name} providers` },
            ...(stateLocation ? [{ href: `/${treatment.slug}/${stateLocation.slug}`, label: `${treatment.name} in ${stateLocation.name}` }] : []),
            { href: '/injectors', label: 'Browse all verified injectors' },
          ]}
        />
        <Footer />
      </>
    )
  }

  const breadcrumbItems = [
    { href: '/', label: 'Home' },
    ...(stateLocation ? [{ href: `/${stateLocation.slug}`, label: stateLocation.name }] : []),
    ...(stateLocation ? [{ href: `/${treatment.slug}/${stateLocation.slug}`, label: `${treatment.name} in ${stateLocation.name}` }] : []),
    { label: city.name },
  ]

  // The Providers tab (default): sponsored cards on top, then the empty state or
  // the filterable provider list + map.
  const providersView = (
    <>
      {/* Sponsored providers */}
      {sponsored.length > 0 && (
        <div className="mb-8">
          <p className="text-caption text-ink-tertiary font-medium uppercase tracking-widest mb-3">Sponsored</p>
          <div className="flex sm:grid sm:grid-cols-2 md:grid-cols-3 gap-3 overflow-x-auto snap-x snap-mandatory -mx-5 px-5 sm:mx-0 sm:px-0 sm:overflow-x-visible pb-1 sm:pb-0">
            {sponsored.map((p) => (
              <div key={p.id} className="flex-shrink-0 w-[78vw] max-w-[300px] snap-start sm:w-auto sm:max-w-none">
                <DirectoryProviderCard provider={p} />
              </div>
            ))}
          </div>
          <hr className="mt-6 border-border" />
        </div>
      )}

      {/* Empty state when city has no providers yet */}
      {providers.length === 0 && sponsored.length === 0 ? (
        <EmptyDirectoryState
          treatmentName={treatment.name}
          treatmentSlug={treatment.slug}
          cityName={cityDisplayName}
          citySlug={city.slug}
          stateCode={stateCode}
          stateLocation={stateLocation ?? null}
        />
      ) : (
        /* Filters + map + provider grid (client component) */
        <ProviderFilters providers={providers} />
      )}
    </>
  )

  return (
    <>
      {schema.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s).replace(/</g, '\\u003c') }} />
      ))}

      <Header />

      <PromoBanner banner={banner} />

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
              ? `${providers.length} verified ${treatment.name} provider${providers.length !== 1 ? 's' : ''} in ${cityDisplayName}. License-verified, patient-reviewed.`
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
          </div>
        </div>
      </section>

      <div className="section-pad bg-surface-canvas">
        <div className="max-canvas">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-10 lg:gap-14 items-start">

            {/* Main column */}
            <div>
              {/* Clinics | Providers tabs.
                  When there are no providers AND no clinics AND no sponsored cards,
                  render just the empty-directory state (no tabs needed).
                  Otherwise always show tabs with Clinics first. */}
              {providers.length === 0 && sponsored.length === 0 && clinics.length === 0 ? (
                <EmptyDirectoryState
                  treatmentName={treatment.name}
                  treatmentSlug={treatment.slug}
                  cityName={cityDisplayName}
                  citySlug={city.slug}
                  stateCode={stateCode}
                  stateLocation={stateLocation ?? null}
                />
              ) : (
                <CityListingTabs
                  providerCount={providers.length}
                  clinicCount={clinics.length}
                  providersView={providersView}
                  clinicsView={<DirectoryClinicsView clinics={clinics} />}
                />
              )}

              {/* Neighborhood quick-links */}
              {neighborhoods.length > 0 && (
                <div className="mt-12">
                  <h2 className="font-serif text-h3 text-ink-primary mb-4">Browse by neighborhood</h2>
                  <div className="flex flex-wrap gap-2">
                    {neighborhoods.map((n) => (
                      <Link
                        key={n.id}
                        href={`/${stateLocation?.slug}/${city.slug}/${n.slug}`}
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
                  <Link href={`/${stateLocation.slug}/${city.slug}`} className="flex items-center justify-between text-body-sm text-ink-secondary hover:text-brand-accent transition py-1">
                    <span>All injectors in {cityDisplayName}</span>
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
