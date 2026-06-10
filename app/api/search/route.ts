import { NextRequest, NextResponse } from 'next/server'
import { searchDirectory, DEFAULT_RADIUS_MILES, type SearchParams } from '@/lib/search-queries'
import { geocode } from '@/lib/geocode'

// Search results depend on query params and are not cacheable per-URL safely.
export const dynamic = 'force-dynamic'

// Light in-memory rate limit: search is high-frequency (debounced typing), so the
// window is generous. Per-instance only (move to Redis before multi-instance —
// see ROADMAP Phase 12).
const rateMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 60
const WINDOW_MS = 60 * 1000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

function num(v: string | null): number | undefined {
  if (v == null || v.trim() === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!checkRateLimit(ip)) {
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
  const limit = num(sp.get('limit')) ?? 24
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
