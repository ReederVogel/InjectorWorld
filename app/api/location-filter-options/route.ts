import { NextRequest, NextResponse } from 'next/server'
import { getCityFilterOptions } from '@/lib/location-queries'

// Real per-city clinic counts for one state, on demand -- backs the City
// dropdown in components/shared/LocationFilterBar.tsx, used by both /clinics
// and /search so both pull from the same source instead of two implementations.
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
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
