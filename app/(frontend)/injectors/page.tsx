import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { PreFooterCta } from '@/components/pre-footer/PreFooterCta'
import { getProvidersListing } from '@/lib/provider-queries'
import { getClinicsListing, type ClinicListItem } from '@/lib/clinic-queries'
import { ProvidersGrid } from './ProvidersGrid'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Find a Verified Injector Near You',
  description:
    'Browse license-verified Botox and aesthetic injectors across the US. Filter by credential, city, and specialty. Real reviews, transparent pricing.',
  openGraph: { type: 'website' },
}

function FeaturedClinicCard({ c }: { c: ClinicListItem }) {
  const stars = Math.round(c.aggregateRating || 0)
  return (
    <Link
      href={`/clinics/${c.slug}`}
      className="group block bg-surface-canvas border border-border rounded-2xl overflow-hidden hover:border-brand-accent hover:shadow-md transition-all duration-200"
    >
      <div className="relative h-[140px] bg-surface overflow-hidden flex-shrink-0">
        {c.photoUrl ? (
          <Image
            src={c.photoUrl}
            alt={c.clinicName}
            fill
            sizes="(min-width:1024px) 16vw, (min-width:768px) 33vw, 50vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-surface to-brand-accent-soft" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
      </div>
      <div className="p-4">
        <p className="font-semibold text-body-sm text-ink-primary leading-tight truncate">{c.clinicName}</p>
        <p className="text-caption text-ink-secondary mt-0.5 truncate">
          {c.neighborhood ? `${c.neighborhood}, ` : ''}{c.city}, {c.state}
        </p>
        {c.aggregateRating ? (
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="star-row text-[11px]">{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
            <span className="text-caption text-ink-tertiary">{c.aggregateRating.toFixed(1)}</span>
          </div>
        ) : null}
      </div>
    </Link>
  )
}

export default async function InjectorsPage() {
  let providers: Awaited<ReturnType<typeof getProvidersListing>> = []
  let featuredClinics: ClinicListItem[] = []
  try {
    ;[providers, featuredClinics] = await Promise.all([
      getProvidersListing(),
      getClinicsListing(6),
    ])
  } catch { /* DB unavailable at build time */ }

  const citiesSorted = Array.from(new Set(providers.map((p) => p.clinic.city))).sort()

  return (
    <>
      <Header />

      {/* Page hero — always-dark navy band (matches Footer pattern) */}
      <section className="bg-[#0B1B34] text-white pt-32 pb-16 md:pt-36 md:pb-20">
        <div className="max-canvas">
          <p className="overline text-brand-accent mb-4 tracking-widest">Directory</p>
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight mb-5 max-w-[680px]">
            Find a verified injector.
          </h1>
          <p className="text-lede-m md:text-lede text-white/70 max-w-[600px] font-serif">
            Every injector listed here is license-verified. Browse by credential, city, or specialty and read real patient reviews before you book.
          </p>

          {/* Quick stats */}
          <div className="flex flex-wrap gap-6 mt-10 pt-10 border-t border-white/10">
            {[
              { n: `${providers.length}`, label: 'Injectors listed' },
              { n: `${citiesSorted.length}`, label: 'Cities' },
              { n: '100%', label: 'License-verified' },
            ].map(({ n, label }) => (
              <div key={label}>
                <div className="font-semibold text-[28px] leading-none text-white">{n}</div>
                <div className="text-caption text-white/60 mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Clinics — shown above providers grid when clinics exist */}
      {featuredClinics.length > 0 && (
        <section className="section-pad bg-surface border-b border-border">
          <div className="max-canvas">
            <div className="flex items-baseline justify-between mb-6">
              <h2 className="font-serif text-h2 text-ink-primary">Clinics</h2>
              <Link href="/clinics" className="text-body-sm text-brand-accent font-medium hover:underline flex items-center gap-1">
                View all
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              {featuredClinics.map((c) => (
                <FeaturedClinicCard key={c.id} c={c} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Providers grid + filters */}
      <section className="section-pad bg-surface-canvas">
        <div className="max-canvas">
          <ProvidersGrid providers={providers} />
        </div>
      </section>

      <PreFooterCta />
      <Footer />
    </>
  )
}
