import { NextRequest, NextResponse } from 'next/server'
import { getPayloadInstance } from '@/lib/payload-server'
import { RateLimiter, getIp } from '@/lib/rate-limit'
import { lookupZip, suggestZips } from '@/lib/zip-lookup'
import { getLocationSlugMap, lookupSlugs } from '@/lib/location-slug-lookup'
import type { Suggestion } from '@/lib/search-client'

type SuggestType = 'all' | 'treatment' | 'location'

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
  // Cities from clinic data so we only suggest places we actually have.
  try {
    const places = await pool.query(
      `SELECT city, state, count(*)::int AS n FROM clinics
       WHERE city IS NOT NULL AND state IS NOT NULL AND status = 'published'
       GROUP BY city, state ORDER BY n DESC LIMIT 300`,
    )
    for (const row of places.rows) {
      const label = `${row.city}, ${row.state}`
      locations.push({ label, href: `/search?location=${encodeURIComponent(label)}`, sublabel: 'City' })
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
  const type: SuggestType = (['treatment', 'location'].includes(
    req.nextUrl.searchParams.get('type') ?? '',
  )
    ? req.nextUrl.searchParams.get('type')
    : 'all') as SuggestType

  if (q.length < 2) {
    return NextResponse.json({ suggestions: [] }, { headers: { 'Cache-Control': 'no-store' } })
  }

  try {
    const payload = await getPayloadInstance()
    const pool = (payload.db as any).pool
    const lists = await getStaticLists(payload, pool)
    const ql = q.toLowerCase()
    const wantTreatment = type !== 'location'
    const wantLocation = type !== 'treatment'

    // ZIP suggestions — real lookups against the zip_codes table (Phase 14).
    // Partial digits (2-4): prefix match returns up to 5 ZIPs.
    // Full 5 digits: resolve city/state for a richer label.
    let zipSuggestions: Suggestion[] = []
    if (wantLocation && /^\d{2,5}$/.test(ql)) {
      if (/^\d{5}$/.test(ql)) {
        const hit = await lookupZip(ql, pool)
        if (hit) {
          zipSuggestions = [
            {
              type: 'zip' as const,
              label: hit.label,
              sublabel: 'ZIP code',
              href: `/search?location=${encodeURIComponent(ql)}`,
            },
          ]
        } else {
          // ZIP not in dataset — still offer a generic search suggestion.
          zipSuggestions = [
            {
              type: 'zip' as const,
              label: ql,
              sublabel: 'ZIP code — search nearby providers',
              href: `/search?location=${encodeURIComponent(ql)}`,
            },
          ]
        }
      } else {
        const hits = await suggestZips(ql, pool, 5)
        zipSuggestions = hits.map((h) => ({
          type: 'zip' as const,
          label: `${h.zip}, ${h.city}, ${h.state}`,
          sublabel: 'ZIP code',
          href: `/search?location=${encodeURIComponent(h.zip)}`,
        }))
      }
    }

    // Treatments (max 4, only for "what" field)
    const treatments: Suggestion[] = wantTreatment
      ? lists.treatments
          .map((t) => ({ t, score: startsOrIncludes(t.name, ql) }))
          .filter((x) => x.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 4)
          .map((x) => ({
            type: 'treatment' as const,
            label: x.t.name,
            sublabel: 'Treatment',
            href: `/services/${x.t.slug}`,
          }))
      : []

    // Locations (max 5, only for "where" field)
    const locations: Suggestion[] = wantLocation
      ? lists.locations
          .map((l) => ({ l, score: startsOrIncludes(l.label, ql) }))
          .filter((x) => x.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)
          .map((x) => ({
            type: 'location' as const,
            label: x.l.label,
            sublabel: x.l.sublabel,
            href: x.l.href,
          }))
      : []

    // Providers + clinics by NAME prefix (max 4 each, only for "what" field).
    // Clinics are returned before providers in the suggestion list.
    let providers: Suggestion[] = []
    let clinics: Suggestion[] = []
    if (wantTreatment) {
      const starts = `${ql}%`
      const wordStarts = `% ${ql}%`
      const [slugMap, pRes, cRes] = await Promise.all([
        getLocationSlugMap(),
        pool.query(
          `SELECT p.slug AS slug, p.full_name AS name, c.city AS city, c.state AS state
             FROM providers p JOIN clinics c ON c.id = p.clinic_id
            WHERE (lower(p.full_name) LIKE $1 OR lower(p.full_name) LIKE $2)
              AND p.status = 'published'
            ORDER BY p.aggregate_rating DESC NULLS LAST LIMIT 4`,
          [starts, wordStarts],
        ),
        pool.query(
          `SELECT slug, clinic_name AS name, city, state
             FROM clinics
            WHERE (lower(clinic_name) LIKE $1 OR lower(clinic_name) LIKE $2)
              AND status = 'published'
            ORDER BY aggregate_rating DESC NULLS LAST LIMIT 4`,
          [starts, wordStarts],
        ),
      ])
      providers = (pRes.rows as any[]).map((row) => {
        const s = lookupSlugs(row.city ?? '', row.state ?? '', slugMap)
        return {
          type: 'provider' as const,
          label: row.name,
          sublabel: [row.city, row.state].filter(Boolean).join(', '),
          href: `/injectors/${s.stateSlug}/${s.citySlug}/${row.slug}`,
        }
      })
      clinics = (cRes.rows as any[]).map((row) => {
        const s = lookupSlugs(row.city ?? '', row.state ?? '', slugMap)
        return {
          type: 'clinic' as const,
          label: row.name,
          sublabel: [row.city, row.state].filter(Boolean).join(', '),
          href: `/clinics/${s.stateSlug}/${s.citySlug}/${row.slug}`,
        }
      })
    }

    const suggestions: Suggestion[] = [
      ...zipSuggestions,
      ...treatments,
      ...locations,
      ...clinics,
      ...providers,
    ].slice(0, 12)

    return NextResponse.json({ suggestions }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: any) {
    console.error('[api/search/suggest] failed:', err?.message ?? err)
    return NextResponse.json({ suggestions: [] }, { status: 200 })
  }
}
