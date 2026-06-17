import { NextRequest, NextResponse } from 'next/server'
import { getPayloadInstance } from '@/lib/payload-server'
import { RateLimiter, getIp } from '@/lib/rate-limit'
import type { Suggestion } from '@/lib/search-client'

// Autocomplete for the omnibox (Phase 13). Fast, typed suggestions: treatments,
// locations (states + cities), and top providers / clinics by name. Read-only.
export const dynamic = 'force-dynamic'

// Generous for debounced typing; suggest is cheaper than full search.
const limiter = new RateLimiter(120, 60 * 1000)

// ── Module-level cache for the static lists (rarely change) ──────────────────
type StaticLists = {
  treatments: { name: string; slug: string; category: string }[]
  locations: { label: string; href: string; sublabel: string }[]
}
let cache: { at: number; lists: StaticLists } | null = null
const TTL_MS = 5 * 60 * 1000

async function getStaticLists(payload: any, pool: any): Promise<StaticLists> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.lists

  const [treatmentsRes, statesRes] = await Promise.all([
    payload.find({ collection: 'treatments', limit: 200, depth: 0, sort: 'name' }),
    payload.find({ collection: 'locations', where: { kind: { equals: 'state' } }, limit: 200, depth: 0 }),
  ])

  const treatments = (treatmentsRes.docs as any[]).map((t) => ({
    name: String(t.name),
    slug: String(t.slug),
    category: String(t.category ?? ''),
  }))

  const locations: { label: string; href: string; sublabel: string }[] = []
  for (const s of statesRes.docs as any[]) {
    if (s.name && s.slug) {
      locations.push({ label: String(s.name), href: `/${s.slug}`, sublabel: 'State' })
    }
  }
  // Cities + neighborhoods from the clinic data, so we only suggest places we have.
  try {
    const places = await pool.query(
      `SELECT city, state, count(*)::int AS n FROM clinics
       WHERE city IS NOT NULL AND state IS NOT NULL
       GROUP BY city, state ORDER BY n DESC LIMIT 300`,
    )
    for (const row of places.rows) {
      const label = `${row.city}, ${row.state}`
      locations.push({ label, href: `/search?q=${encodeURIComponent(label)}`, sublabel: 'City' })
    }
  } catch {
    /* fall back to states only */
  }

  cache = { at: Date.now(), lists: { treatments, locations } }
  return cache.lists
}

function startsOrIncludes(haystack: string, q: string): number {
  const h = haystack.toLowerCase()
  if (h.startsWith(q)) return 2
  if (h.includes(q)) return 1
  return 0
}

export async function GET(req: NextRequest) {
  if (!limiter.check(getIp(req))) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length < 2) {
    return NextResponse.json({ suggestions: [] }, { headers: { 'Cache-Control': 'no-store' } })
  }

  try {
    const payload = await getPayloadInstance()
    const pool = (payload.db as any).pool
    const lists = await getStaticLists(payload, pool)
    const ql = q.toLowerCase()

    // Treatments (max 4)
    const treatments: Suggestion[] = lists.treatments
      .map((t) => ({ t, score: startsOrIncludes(t.name, ql) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((x) => ({
        type: 'treatment' as const,
        label: x.t.name,
        sublabel: x.t.category ? `Treatment guide` : 'Treatment',
        href: `/${x.t.slug}`,
      }))

    // Locations (max 4)
    const locations: Suggestion[] = lists.locations
      .map((l) => ({ l, score: startsOrIncludes(l.label, ql) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((x) => ({
        type: 'location' as const,
        label: x.l.label,
        sublabel: x.l.sublabel,
        href: x.l.href,
      }))

    // Providers + clinics by NAME prefix (max 4 each). Name-only (not the full
    // weighted document) so autocomplete is not polluted by bio/address words
    // (e.g. "new" matching "new patients" in a bio). Matches a name that starts
    // with the term, or any word in the name that starts with the term.
    const starts = `${ql}%`
    const wordStarts = `% ${ql}%`
    const [pRes, cRes] = await Promise.all([
      pool.query(
        `SELECT p.slug AS slug, p.full_name AS name, c.city AS city, c.state AS state
           FROM providers p JOIN clinics c ON c.id = p.clinic_id
          WHERE lower(p.full_name) LIKE $1 OR lower(p.full_name) LIKE $2
          ORDER BY p.aggregate_rating DESC NULLS LAST LIMIT 4`,
        [starts, wordStarts],
      ),
      pool.query(
        `SELECT slug, clinic_name AS name, city, state
           FROM clinics
          WHERE lower(clinic_name) LIKE $1 OR lower(clinic_name) LIKE $2
          ORDER BY aggregate_rating DESC NULLS LAST LIMIT 4`,
        [starts, wordStarts],
      ),
    ])
    const providers: Suggestion[] = (pRes.rows as any[]).map((row) => ({
      type: 'provider' as const,
      label: row.name,
      sublabel: [row.city, row.state].filter(Boolean).join(', '),
      href: `/injectors/${row.slug}`,
    }))
    const clinics: Suggestion[] = (cRes.rows as any[]).map((row) => ({
      type: 'clinic' as const,
      label: row.name,
      sublabel: [row.city, row.state].filter(Boolean).join(', '),
      href: `/clinics/${row.slug}`,
    }))

    // Order groups: treatment + location intent first (a short term like "bot" is
    // almost always the Botox treatment), then named providers + clinics.
    const suggestions = [...treatments, ...locations, ...providers, ...clinics].slice(0, 12)
    return NextResponse.json({ suggestions }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: any) {
    console.error('[api/search/suggest] failed:', err?.message ?? err)
    return NextResponse.json({ suggestions: [] }, { status: 200 })
  }
}
