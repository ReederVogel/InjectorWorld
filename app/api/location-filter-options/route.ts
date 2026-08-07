import { NextRequest, NextResponse } from 'next/server'
import { getCityFilterOptions } from '@/lib/location-queries'
import { RateLimiter, enforceLimit } from '@/lib/rate-limit'

// Public, unauthenticated, aggregates per-city clinic counts on every call.
// See app/api/city-clinics/route.ts for why this is not optional.
const limiter = new RateLimiter(60, 60 * 1000)

// Real per-city clinic counts for one state, on demand -- backs the City
// dropdown in components/shared/LocationFilterBar.tsx, used by both /clinics
// and /search so both pull from the same source instead of two implementations.
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const blocked = await enforceLimit(req, limiter, 'location-filter-options')
  if (blocked) return blocked

  const stateCode = req.nextUrl.searchParams.get('state') ?? ''
  if (!stateCode) {
    return NextResponse.json({ cities: [] })
  }
  try {
    const cities = await getCityFilterOptions(stateCode)
    return NextResponse.json({ cities })
  } catch {
    return NextResponse.json({ cities: [] })
  }
}
