import type { Metadata } from 'next'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { PreFooterCta } from '@/components/pre-footer/PreFooterCta'
import { getClinicsListing, getClinicsStats } from '@/lib/clinic-queries'
import { getPayloadInstance } from '@/lib/payload-server'
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
  let stats = { total: 0, stateCount: 0, avgRating: '0.0' }
  let stateOptions: Array<{ code: string; name: string; slug: string }> = []
  let serviceOptions: Array<{ id: string; name: string }> = []
  let brandOptions: Array<{ id: string; name: string }> = []

  try {
    const payload = await getPayloadInstance()
    const [clinicsData, statsData, statesRes, servicesRes, brandsRes] = await Promise.all([
      getClinicsListing(24),
      getClinicsStats(),
      payload.find({ collection: 'locations', where: { kind: { equals: 'state' } }, limit: 60, sort: 'name', depth: 0 }),
      payload.find({ collection: 'services', limit: 100, sort: 'name', depth: 0 }),
      payload.find({ collection: 'brands', limit: 200, sort: 'name', depth: 0 }),
    ])

    clinics = clinicsData
    stats = statsData
    stateOptions = (statesRes.docs as any[])
      .map((s) => ({ code: s.state ?? '', name: s.name, slug: s.slug }))
      .filter((s) => s.code)
    serviceOptions = (servicesRes.docs as any[]).map((s) => ({ id: String(s.id), name: s.name }))
    brandOptions = (brandsRes.docs as any[]).map((b) => ({ id: String(b.id), name: b.name }))
  } catch { /* DB unavailable at build time */ }

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
              { n: stats.total > 0 ? stats.total.toLocaleString() : `${clinics.length}`, label: 'Clinics listed' },
              { n: `${stats.stateCount > 0 ? stats.stateCount : Array.from(new Set(clinics.map((c) => c.state))).length}`, label: 'States' },
              { n: stats.avgRating !== '0.0' ? stats.avgRating : '—', label: 'Average rating' },
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
          <ClinicsGrid
            initialClinics={clinics}
            totalClinics={stats.total || clinics.length}
            stateOptions={stateOptions}
            serviceOptions={serviceOptions}
            brandOptions={brandOptions}
          />
        </div>
      </section>

      <PreFooterCta />
      <Footer />
    </>
  )
}
