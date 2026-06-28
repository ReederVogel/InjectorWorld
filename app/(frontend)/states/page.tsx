import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { getPayloadInstance } from '@/lib/payload-server'
import { USMapClient } from '@/components/states/USMapClient'

export const revalidate = 300

export const metadata: Metadata = {
  title: { absolute: 'Browse verified injectors by state | injector.world' },
  description:
    'Find license-verified Botox and aesthetic injectors in every US state. Browse our directory state by state.',
  alternates: { canonical: 'https://injector.world/states' },
}

export default async function StatesIndexPage() {
  const payload = await getPayloadInstance()
  const res = await payload.find({
    collection: 'locations',
    where: { kind: { equals: 'state' } },
    limit: 60,
    sort: 'name',
    depth: 0,
  })

  const counts = new Map<string, number>()
  try {
    const pool = (payload.db as any).pool
    const r = await pool.query(
      `SELECT upper(state) AS code, count(*)::int AS n FROM clinics
       WHERE status = 'published' AND state IS NOT NULL GROUP BY upper(state)`,
    )
    for (const row of r.rows) counts.set(String(row.code).toUpperCase(), Number(row.n))
  } catch { /* fall back to 0 counts */ }

  const states = (res.docs as any[]).map((s) => ({
    name: s.name,
    slug: s.slug,
    abbr: String(s.state ?? '').toUpperCase(),
    isLive: s.isLive === true,
    clinicCount: counts.get(String(s.state ?? '').toUpperCase()) ?? 0,
  }))

  const live = states.filter((s) => s.isLive).sort((a, b) => b.clinicCount - a.clinicCount)
  const soon = states.filter((s) => !s.isLive).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <>
      <Header />

      <div className="bg-surface border-b border-border">
        <div className="max-canvas py-3">
          <nav className="flex items-center gap-2 text-caption text-ink-tertiary" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-ink-primary transition">Home</Link>
            <span>/</span>
            <span className="text-ink-primary">States</span>
          </nav>
        </div>
      </div>

      <section className="bg-surface-canvas pt-10 pb-8 border-b border-border">
        <div className="max-canvas">
          <span className="text-overline uppercase tracking-widest font-semibold text-brand-accent mb-3 block">
            Browse by State
          </span>
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-3">
            Verified injectors in every state
          </h1>
          <p className="text-body-lg text-ink-secondary max-w-2xl">
            Find license-verified aesthetic injectors near you. Live markets are open now, the rest are coming soon.
          </p>
        </div>
      </section>

      <div className="section-pad bg-surface-canvas">
        <div className="max-canvas space-y-14">
          {/* Interactive US map */}
          <USMapClient states={states} />

          {/* Live states list */}
          {live.length > 0 && (
            <div>
              <h2 className="font-serif text-h3 text-ink-primary mb-5">Live now</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {live.map((s) => (
                  <Link
                    key={s.slug}
                    href={`/${s.slug}`}
                    className="group flex items-center justify-between p-4 rounded-xl border border-border bg-surface hover:border-brand-accent hover:bg-surface-warm transition-all"
                  >
                    <div>
                      <div className="font-medium text-body-sm text-ink-primary group-hover:text-brand-accent transition leading-tight">{s.name}</div>
                      {s.clinicCount > 0 && (
                        <div className="text-caption text-ink-tertiary mt-0.5">{s.clinicCount.toLocaleString()} clinics</div>
                      )}
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-tertiary group-hover:text-brand-accent flex-shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Coming soon list */}
          {soon.length > 0 && (
            <div>
              <h2 className="font-serif text-h3 text-ink-primary mb-5">Coming soon</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {soon.map((s) => (
                  <Link
                    key={s.slug}
                    href={`/${s.slug}`}
                    className="group flex items-center justify-between p-4 rounded-xl border border-border bg-surface/60 hover:border-brand-accent transition-all"
                  >
                    <span className="font-medium text-body-sm text-ink-secondary group-hover:text-brand-accent transition leading-tight">{s.name}</span>
                    <span className="text-caption text-ink-tertiary">Soon</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </>
  )
}
