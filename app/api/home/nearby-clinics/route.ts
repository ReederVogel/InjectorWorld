import { NextRequest, NextResponse } from 'next/server'
import { getNearbyClinics } from '@/lib/nearby-clinics'
import { RateLimiter, enforceLimit } from '@/lib/rate-limit'

/**
 * Tighter than the listing routes (30/min vs 60/min) because this one runs a
 * PostGIS distance query, which is materially more expensive per call than the
 * indexed lookups the other public routes do. It is also called once on mount
 * rather than once per page of results, so a lower cap costs nothing real.
 */
const limiter = new RateLimiter(30, 60 * 1000)

export async function GET(req: NextRequest) {
  const blocked = await enforceLimit(req, limiter, 'nearby-clinics')
  if (blocked) return blocked

  const { searchParams } = new URL(req.url)
  const lat = Number(searchParams.get('lat'))
  const lng = Number(searchParams.get('lng'))
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ clinics: [] })
  }

  try {
    const clinics = await getNearbyClinics(lat, lng, 6)
    return NextResponse.json({ clinics })
  } catch {
    return NextResponse.json({ clinics: [] })
  }
}
