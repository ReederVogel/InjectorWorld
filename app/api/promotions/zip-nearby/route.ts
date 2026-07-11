import { NextRequest, NextResponse } from 'next/server'
import { getZipScopedBanner } from '@/lib/promotions'
import { RateLimiter, getIp } from '@/lib/rate-limit'

// Public, read-only lookup called client-side by ZipPromoBanner. Rate-limited
// per IP since it's unauthenticated and runs on every relevant page view.
const limiter = new RateLimiter(30, 60 * 1000)

export async function GET(req: NextRequest) {
  if (!limiter.check(getIp(req))) {
    return NextResponse.json({ banner: null }, { status: 429 })
  }

  const { searchParams } = new URL(req.url)
  const lat = Number(searchParams.get('lat'))
  const lng = Number(searchParams.get('lng'))
  const serviceId = searchParams.get('serviceId') || undefined

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ banner: null })
  }

  try {
    const banner = await getZipScopedBanner(lat, lng, serviceId)
    return NextResponse.json({ banner })
  } catch {
    return NextResponse.json({ banner: null })
  }
}
