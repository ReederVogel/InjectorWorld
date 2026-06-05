import type { Metadata } from 'next'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { PreFooterCta } from '@/components/pre-footer/PreFooterCta'
import { getProvidersListing } from '@/lib/provider-queries'
import { ProvidersGrid } from './ProvidersGrid'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Find a Verified Injector Near You',
  description:
    'Browse license-verified Botox and aesthetic injectors across the US. Filter by credential, city, and specialty. Real reviews, transparent pricing.',
  openGraph: { type: 'website' },
}

export default async function InjectorsPage() {
  const providers = await getProvidersListing()

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

      {/* Grid + filters */}
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
