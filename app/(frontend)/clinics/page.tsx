import type { Metadata } from 'next'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { PreFooterCta } from '@/components/pre-footer/PreFooterCta'
import { getClinicsListing } from '@/lib/clinic-queries'
import { ClinicsGrid } from './ClinicsGrid'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Aesthetic Clinics Directory',
  description:
    'Browse verified aesthetic clinics across the US. Read patient reviews, check credentials, and find clinics near you.',
  openGraph: { type: 'website' },
}

export default async function ClinicsPage() {
  let clinics: Awaited<ReturnType<typeof getClinicsListing>> = []
  try { clinics = await getClinicsListing() } catch { /* DB unavailable at build time */ }

  const states = Array.from(new Set(clinics.map((c) => c.state))).sort()
  const avgRating =
    clinics.length > 0
      ? (clinics.reduce((a, c) => a + (c.aggregateRating || 0), 0) / clinics.length).toFixed(1)
      : '4.9'

  return (
    <>
      <Header />

      {/* Page hero — always-dark navy band (matches Footer pattern) */}
      <section className="bg-[#0B1B34] text-white pt-32 pb-16 md:pt-36 md:pb-20">
        <div className="max-canvas">
          <p className="overline text-brand-accent mb-4 tracking-widest">Clinics</p>
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight mb-5 max-w-[680px]">
            Verified aesthetic clinics.
          </h1>
          <p className="text-lede-m md:text-lede text-white/70 max-w-[600px] font-serif">
            Every clinic listed here is independently reviewed. Browse by state, read patient reviews, and book with confidence.
          </p>

          {/* Quick stats */}
          <div className="flex flex-wrap gap-6 mt-10 pt-10 border-t border-white/10">
            {[
              { n: `${clinics.length}`, label: 'Clinics listed' },
              { n: `${states.length}`, label: 'States' },
              { n: avgRating, label: 'Average rating' },
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
          <ClinicsGrid clinics={clinics} />
        </div>
      </section>

      <PreFooterCta />
      <Footer />
    </>
  )
}
