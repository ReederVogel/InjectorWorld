import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { PreFooterCta } from '@/components/pre-footer/PreFooterCta'
import { getBrandsListing, type BrandListItem } from '@/lib/brand-queries'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Aesthetic Brands & Multi-location Groups',
  description:
    'Browse aesthetic brands and the clinic groups behind them. See every location and provider under one brand, all independently verified.',
  openGraph: { type: 'website' },
}

export default async function BrandsPage() {
  let brands: BrandListItem[] = []
  try { brands = await getBrandsListing() } catch { /* DB unavailable at build time */ }

  const totalLocations = brands.reduce((a, b) => a + b.locationCount, 0)

  return (
    <>
      <Header />

      {/* Page hero — always-dark navy band */}
      <section className="bg-[#0B1B34] text-white pt-32 pb-16 md:pt-36 md:pb-20">
        <div className="max-canvas">
          <p className="overline text-brand-accent mb-4 tracking-widest">Brands</p>
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight mb-5 max-w-[680px]">
            Aesthetic brands, every location in one place.
          </h1>
          <p className="text-lede-m md:text-lede text-white/70 max-w-[600px] font-serif">
            Some practices run more than one location. A brand page brings every branch and provider
            together, each one independently verified.
          </p>

          {brands.length > 0 && (
            <div className="flex flex-wrap gap-6 mt-10 pt-10 border-t border-white/10">
              {[
                { n: `${brands.length}`, label: brands.length === 1 ? 'Brand' : 'Brands' },
                { n: `${totalLocations}`, label: 'Locations' },
              ].map(({ n, label }) => (
                <div key={label}>
                  <div className="font-semibold text-[28px] leading-none text-white">{n}</div>
                  <div className="text-caption text-white/60 mt-1">{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Grid */}
      <section className="section-pad bg-surface-canvas">
        <div className="max-canvas">
          {brands.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-body text-ink-secondary mb-2">No multi-location brands yet.</p>
              <p className="text-body-sm text-ink-tertiary">
                Browse individual{' '}
                <Link href="/clinics" className="text-brand-accent hover:underline">clinics</Link>{' '}
                or{' '}
                <Link href="/states" className="text-brand-accent hover:underline">find by state</Link>{' '}
                in the meantime.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
              {brands.map((b) => (
                <BrandCard key={b.id} b={b} />
              ))}
            </div>
          )}
        </div>
      </section>

      <PreFooterCta />
      <Footer />
    </>
  )
}

function BrandCard({ b }: { b: BrandListItem }) {
  const cityLine =
    b.cities.length > 0
      ? `${b.cities.slice(0, 3).join(', ')}${b.cities.length > 3 ? ` +${b.cities.length - 3} more` : ''}`
      : ''
  return (
    <Link
      href={`/brands/${b.slug}`}
      className="group card-premium bg-surface-canvas rounded-2xl overflow-hidden flex flex-col border-2 border-border hover:border-brand-accent transition-all duration-200"
    >
      <div className="relative h-[180px] bg-surface overflow-hidden flex-shrink-0">
        {b.photoUrl ? (
          <Image
            src={b.photoUrl}
            alt={b.name}
            fill
            sizes="(min-width:1024px) 33vw, (min-width:768px) 50vw, 100vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-surface to-brand-accent-soft" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
        {/* Logo / monogram chip */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <span className="w-10 h-10 rounded-xl bg-white/95 flex items-center justify-center overflow-hidden flex-shrink-0">
            {b.logoUrl ? (
              <Image src={b.logoUrl} alt={b.name} width={32} height={32} className="object-contain" />
            ) : (
              <span className="font-serif text-[20px] text-ink-primary leading-none">{b.name.charAt(0)}</span>
            )}
          </span>
          <span className="bg-white/90 text-ink-primary text-[11px] font-semibold px-2.5 py-1 rounded-pill">
            {b.locationCount} {b.locationCount === 1 ? 'location' : 'locations'}
          </span>
        </div>
      </div>
      <div className="p-5 flex flex-col flex-1">
        <h2 className="font-semibold text-body text-ink-primary mb-1 leading-tight group-hover:text-brand-accent transition">
          {b.name}
        </h2>
        {cityLine && <p className="text-body-sm text-ink-secondary mb-3">{cityLine}</p>}
        {b.description && (
          <p className="text-body-sm text-ink-secondary mb-3 line-clamp-2">{b.description}</p>
        )}
        <span className="mt-auto inline-flex items-center gap-1.5 text-body-sm font-medium text-brand-accent">
          View brand
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
        </span>
      </div>
    </Link>
  )
}
