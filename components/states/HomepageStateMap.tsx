import Link from 'next/link'
import { getPayloadInstance } from '@/lib/payload-server'
import { USMapClient } from './USMapClient'

export async function HomepageStateMap() {
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

  return (
    <section className="bg-[#0A1424] py-24 md:py-32 relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 mesh-dark pointer-events-none" />
      <div aria-hidden className="absolute inset-0 dot-grid opacity-40 pointer-events-none" />

      <div className="max-canvas relative">
        <div className="flex items-end justify-between gap-6 mb-12 md:mb-14 flex-wrap">
          <div className="max-w-[640px]">
            <h2 className="headline-display text-h2-m md:text-h2 text-white mb-2">Find by state.</h2>
            <p className="font-serif text-[20px] md:text-[24px] leading-[1.3] text-white/70 font-normal">
              Select your state to browse verified clinics near you.
            </p>
          </div>
          <Link
            href="/states"
            className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-pill border border-white/15 bg-white/5 backdrop-blur text-body-sm font-medium text-white hover:bg-white/10 hover:border-[#3FA68A] transition"
          >
            All 50 states
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="group-hover:translate-x-0.5 transition">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        </div>

        <USMapClient states={states} />
      </div>
    </section>
  )
}
