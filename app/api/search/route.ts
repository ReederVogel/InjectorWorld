import { NextRequest, NextResponse } from 'next/server'
import { searchDirectory, DEFAULT_RADIUS_MILES, type SearchParams } from '@/lib/search-queries'
import { geocode } from '@/lib/geocode'
import { RateLimiter, getIp } from '@/lib/rate-limit'

// Search results depend on query params and are not cacheable per-URL safely.
export const dynamic = 'force-dynamic'

// 60 searches per IP per minute. Generous for debounced typing.
// Move to Redis before multi-instance — see ROADMAP Phase 12 + docs/DECISIONS.md.
const limiter = new RateLimiter(60, 60 * 1000)

function num(v: string | null): number | undefined {
  if (v == null || v.trim() === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

export async function GET(req: NextRequest) {
  if (!limiter.check(getIp(req))) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const sp = req.nextUrl.searchParams
  const q = (sp.get('q') ?? '').trim()
  const treatment = (sp.get('treatment') ?? '').trim()
  const location = (sp.get('location') ?? '').trim()
  const typeParam = (sp.get('type') ?? 'all').trim()
  const type: SearchParams['type'] =
    typeParam === 'providers' || typeParam === 'clinics' ? typeParam : 'all'
  const page = num(sp.get('page')) ?? 1
  const limit = Math.min(num(sp.get('limit')) ?? 24, 100) // cap at 100 to prevent full-table pulls
  const radiusMiles = num(sp.get('radius')) ?? DEFAULT_RADIUS_MILES

  // Coordinates: passed directly, or geocoded from the typed location text.
  let lat = num(sp.get('lat'))
  let lng = num(sp.get('lng'))
  let resolvedLocationLabel: string | undefined

  // "near me" / an explicit address that isn't one of our state names -> geocode.
  // We only geocode when no lat/lng were supplied. A bare state/city name is also
  // handled as text inside searchDirectory, so we only geocode when the caller
  // asked for radius behaviour by passing useGeo=1, OR when lat/lng absent and the
  // location looks like a specific place (handled conservatively below).
  const wantGeo = sp.get('geo') === '1'
  if (lat === undefined && lng === undefined && wantGeo && location) {
    const hit = await geocode(location)
    if (hit) {
      lat = hit.lat
      lng = hit.lng
      resolvedLocationLabel = hit.label
    }
  }

  try {
    const result = await searchDirectory({
      q,
      treatment,
      location,
      lat,
      lng,
      radiusMiles,
      type,
      page,
      limit,
    })
    if (resolvedLocationLabel && !result.locationLabel) {
      result.locationLabel = resolvedLocationLabel
    }
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: any) {
    console.error('[api/search] failed:', err?.message ?? err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
