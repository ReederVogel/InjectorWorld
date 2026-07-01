import type { Metadata } from 'next'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { PreFooterCta } from '@/components/pre-footer/PreFooterCta'
import { searchDirectory, getSearchFilterOptions } from '@/lib/search-queries'
import { getLocationFilterOptions } from '@/lib/location-queries'
import { getTopResults } from '@/lib/search-content'
import { TopResults } from '@/components/search/TopResults'
import { HeaderSearchBar } from '@/components/header/HeaderSearchBar'
import { SearchMapSection } from '@/components/search/SearchMapSection'
import { SearchResultsWithFilters } from '@/components/search/SearchResultsWithFilters'

// Results depend on query params and are not indexable, so render on demand.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Search verified injectors and clinics',
  description:
    'Search license-verified Botox and aesthetic injectors and clinics by treatment, location, ZIP, name, or anything in between.',
  robots: { index: false, follow: true },
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; treatment?: string; location?: string }>
}) {
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  // Backward-compatible: older links still use treatment/location params.
  const treatment = (sp.treatment ?? '').trim()
  const location = (sp.location ?? '').trim()
  // The omnibox prefill is the free-text q, or the legacy fields joined.
  const omniValue = q || [treatment, location].filter(Boolean).join(' ')
  const hasQuery = !!(q || treatment || location)

  // Request a generous page-1 window so the client "Load more" covers the set at
  // current data scale. allowGeocode turns a ZIP / place name into a radius search.
  const [result, topResults, filterOptions, stateOptions] = hasQuery
    ? await Promise.all([
        searchDirectory({ q, treatment, location, limit: 100, allowGeocode: true }),
        getTopResults(omniValue),
        getSearchFilterOptions(),
        getLocationFilterOptions(),
      ])
    : [
        {
          providers: [],
          clinics: [],
          treatmentLabel: undefined as string | undefined,
          locationLabel: undefined as string | undefined,
          providerTotal: 0,
          clinicTotal: 0,
        },
        [],
        { brandOptions: [], serviceOptions: [] },
        [],
      ]

  const total = result.providerTotal + result.clinicTotal
  const treatmentText = result.treatmentLabel || treatment
  const brandText = result.brandLabel
  const locationText = result.locationLabel || location

  // Build a plain-language summary line (no em dashes).
  let summary = ''
  if (brandText && locationText) summary = `${brandText} injectors in ${locationText}`
  else if (brandText) summary = `${brandText} injectors`
  else if (treatmentText && locationText) summary = `${treatmentText} in ${locationText}`
  else if (treatmentText) summary = treatmentText
  else if (locationText) summary = `Injectors in ${locationText}`
  else if (q) summary = `Results for ${q}`

  return (
    <>
      <Header />

      {/* Search hero */}
      <section className="bg-surface border-b border-border pt-8 pb-8">
        <div className="max-canvas">
          <span className="text-overline uppercase tracking-widest font-semibold text-brand-accent mb-2 block">
            Search
          </span>
          <h1 className="font-serif text-h3 sm:text-h2-m md:text-h2 lg:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-1">
            {hasQuery ? (summary || 'Search results') : 'Find a verified injector'}
          </h1>
          {hasQuery ? (
            <p className="text-body-sm text-ink-secondary mb-5">
              {total} {total === 1 ? 'result' : 'results'} across providers and clinics.
            </p>
          ) : (
            <p className="text-body-sm text-ink-secondary mb-5">
              Search by treatment, location, ZIP, or name to find license-verified providers and clinics.
            </p>
          )}
          <HeaderSearchBar defaultQuery={omniValue} className="max-w-2xl" autoFocus={!hasQuery} />
        </div>
      </section>

      {/* Results */}
      <section className="section-pad bg-surface-canvas">
        <div className="max-canvas">
          {!hasQuery ? (
            <p className="text-body text-ink-secondary py-8">
              Enter a treatment, location, ZIP, or name above to begin.
            </p>
          ) : (
            <>
              <TopResults results={topResults} />
              {total === 0 ? (
                topResults.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-body text-ink-primary font-medium mb-2">No matches found</p>
                    <p className="text-body-sm text-ink-secondary max-w-md mx-auto">
                      Try a broader treatment or a nearby city. Our launch markets are California,
                      Texas, New York, and Florida; other states are coming soon.
                    </p>
                  </div>
                ) : (
                  <p className="text-body-sm text-ink-secondary py-4">
                    No providers or clinics matched, but the guides above may help.
                  </p>
                )
              ) : (
                <>
                  <p className="text-ink-secondary text-sm mb-4">
                    {total >= 100
                      ? 'Showing top 100 results. Refine your search for more.'
                      : `Showing ${total} result${total === 1 ? '' : 's'}`}
                  </p>
                  {locationText && result.providers.length > 0 && (
                    <SearchMapSection providers={result.providers} />
                  )}
                  <SearchResultsWithFilters
                    providers={result.providers}
                    clinics={result.clinics}
                    brandOptions={filterOptions.brandOptions}
                    serviceOptions={filterOptions.serviceOptions}
                    stateOptions={locationText ? [] : stateOptions}
                    query={q}
                  />
                </>
              )}
            </>
          )}
        </div>
      </section>

      <PreFooterCta />
      <Footer />
    </>
  )
}
