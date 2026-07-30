import { NextRequest, NextResponse } from 'next/server'
import { getPayloadInstance } from '@/lib/payload-server'
import { RateLimiter, getIp } from '@/lib/rate-limit'

/**
 * Clinic name lookup for the "is your practice already listed?" step of the
 * claim / listing funnel.
 *
 * Distinct from /api/search/suggest, which is a directory typeahead: this one
 * returns the claim state of each match so the UI can tell an owner whether the
 * profile is claimable, and it deliberately does NOT link to the public clinic
 * page. Keeping it separate also means the claim funnel never depends on the
 * shape of the directory omnibox.
 */
export const dynamic = 'force-dynamic'

const limiter = new RateLimiter(60, 60 * 1000)

const MIN_QUERY = 2
const LIMIT = 8

export type ClinicLookupResult = {
  slug: string
  name: string
  city: string | null
  state: string | null
  claimed: boolean
  claimHref: string
}

export async function GET(req: NextRequest) {
  if (!(await limiter.check(getIp(req)))) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
  }

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length < MIN_QUERY) {
    return NextResponse.json({ results: [] })
  }

  const payload = await getPayloadInstance()
  const pool = (payload.db as { pool: { query: (sql: string, params: unknown[]) => Promise<{ rows: unknown[] }> } }).pool

  const ql = q.toLowerCase()
  // Match a name that starts with the query, or where any word does. Anchoring
  // to word starts keeps "park" from matching "Sparkle", which matters here:
  // an owner scanning results for their own clinic should see obvious hits.
  const starts = `${ql}%`
  const wordStarts = `% ${ql}%`

  let rows: Record<string, unknown>[] = []
  try {
    const res = await pool.query(
      `SELECT slug, clinic_name AS name, city, state, COALESCE(claimed, false) AS claimed
         FROM clinics
        WHERE (lower(clinic_name) LIKE $1 OR lower(clinic_name) LIKE $2)
          AND status = 'published'
        ORDER BY
          -- exact prefix matches first, then by how established the clinic looks
          CASE WHEN lower(clinic_name) LIKE $1 THEN 0 ELSE 1 END,
          aggregate_rating_count DESC NULLS LAST
        LIMIT ${LIMIT}`,
      [starts, wordStarts],
    )
    rows = res.rows as Record<string, unknown>[]
  } catch (err) {
    payload.logger.error(`[clinics/lookup] query failed: ${(err as Error)?.message}`)
    return NextResponse.json({ error: 'Lookup failed.' }, { status: 500 })
  }

  const results: ClinicLookupResult[] = rows.map((row) => ({
    slug: String(row.slug),
    name: String(row.name),
    city: (row.city as string) ?? null,
    state: (row.state as string) ?? null,
    claimed: Boolean(row.claimed),
    claimHref: `/claim/clinic/${row.slug}`,
  }))

  // Claim state changes the moment an owner is approved, and a stale "claimable"
  // result would send them into a form that then rejects them — so never cache.
  return NextResponse.json({ results }, { headers: { 'Cache-Control': 'no-store' } })
}
