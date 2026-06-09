import type { Metadata } from 'next'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { PreFooterCta } from '@/components/pre-footer/PreFooterCta'
import { searchDirectory } from '@/lib/search-queries'
import { ProviderClinicResults } from '@/components/shared/ProviderClinicResults'
import { HeaderSearchBar } from '@/components/header/HeaderSearchBar'

// Results depend on query params and are not indexable, so render on demand.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Search verified injectors and clinics',
  description:
    'Search license-verified Botox and aesthetic injectors and clinics by treatment and location.',
  robots: { index: false, follow: true },
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ treatment?: string; location?: string }>
}) {
  const sp = await searchParams
  const treatment = (sp.treatment ?? '').trim()
  const location = (sp.location ?? '').trim()
  const hasQuery = !!(treatment || location)

  const result = hasQuery
    ? await searchDirectory({ treatment, location })
    : { providers: [], clinics: [], treatmentLabel: undefined, locationLabel: undefined }

  const total = result.providers.length + result.clinics.length
  const treatmentText = result.treatmentLabel || treatment
  const locationText = result.locationLabel || location

  // Build a plain-language summary line (no em dashes).
  let summary = ''
  if (treatmentText && locationText) summary = `${treatmentText} in ${locationText}`
  else if (treatmentText) summary = treatmentText
  else if (locationText) summary = `Injectors in ${locationText}`

  return (
    <>
      <Header />

      {/* Search hero */}
      <section className="bg-surface border-b border-border pt-8 pb-8">
        <div className="max-canvas">
          <span className="text-overline uppercase tracking-widest font-semibold text-brand-accent mb-2 block">
            Search
          </span>
          <h1 className="font-serif text-h2-m md:text-h2 font-medium leading-tight tracking-tight text-ink-primary mb-1">
            {hasQuery ? (summary || 'Search results') : 'Find a verified injector'}
          </h1>
          {hasQuery ? (
            <p className="text-body-sm text-ink-secondary mb-5">
              {total} {total === 1 ? 'result' : 'results'} across providers and clinics.
            </p>
          ) : (
            <p className="text-body-sm text-ink-secondary mb-5">
              Search by treatment and location to find license-verified providers and clinics.
            </p>
          )}
          <HeaderSearchBar
            defaultTreatment={treatment}
            defaultLocation={location}
            className="max-w-2xl"
            autoFocus={!hasQuery}
          />
        </div>
      </section>

      {/* Results */}
      <section className="section-pad bg-surface-canvas">
        <div className="max-canvas">
          {!hasQuery ? (
            <p className="text-body text-ink-secondary py-8">
              Enter a treatment or location above to begin.
            </p>
          ) : total === 0 ? (
            <div className="py-12 text-center">
              <p className="text-body text-ink-primary font-medium mb-2">No matches found</p>
              <p className="text-body-sm text-ink-secondary max-w-md mx-auto">
                Try a broader treatment or a nearby city. Our launch markets are California,
                Texas, New York, and Florida; other states are coming soon.
              </p>
            </div>
          ) : (
            <ProviderClinicResults providers={result.providers} clinics={result.clinics} />
          )}
        </div>
      </section>

      <PreFooterCta />
      <Footer />
    </>
  )
}
