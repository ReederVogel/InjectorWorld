import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { ProviderFilters } from '@/components/shared/ProviderFilters'
import type { NeighborhoodData } from '@/lib/location-queries'

type Props = { data: NeighborhoodData; schema: object[] }

export function NeighborhoodPage({ data, schema }: Props) {
  const { treatment, city, neighborhood, providers, faqs } = data
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
          <nav className="flex items-center gap-2 text-caption text-ink-tertiary flex-wrap" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-ink-primary transition">Home</Link>
            <span>/</span>
            <Link href={`/${treatment.slug}`} className="hover:text-ink-primary transition">{treatment.name}</Link>
            <span>/</span>
            <Link href={`/${treatment.slug}/${city.slug}`} className="hover:text-ink-primary transition">{cityDisplay}</Link>
            <span>/</span>
            <span className="text-ink-primary">{neighborhood.name}</span>
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
            {treatment.name} in {neighborhood.name}, {cityDisplay}
          </h1>
          <p className="text-body-lg text-ink-secondary max-w-2xl">
            {providers.length > 0
              ? `${providers.length} verified provider${providers.length !== 1 ? 's' : ''} near ${neighborhood.name}. License-verified.`
              : `Find verified ${treatment.name} providers near ${neighborhood.name}.`}
          </p>
        </div>
      </section>

      <div className="section-pad bg-surface-canvas">
        <div className="max-canvas">
          <ProviderFilters providers={providers} />

          {/* Up-links */}
          <div className="mt-12 pt-8 border-t border-border flex flex-wrap gap-4 text-body-sm">
            <Link href={`/${treatment.slug}/${city.slug}`} className="flex items-center gap-1.5 text-brand-accent hover:underline">
              All {treatment.name} in {cityDisplay}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </Link>
            <Link href={`/${treatment.slug}`} className="flex items-center gap-1.5 text-brand-accent hover:underline">
              All {treatment.name} providers
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </>
  )
}
