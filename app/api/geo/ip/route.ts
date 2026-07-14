import { NextRequest, NextResponse } from 'next/server'

export type GeoIpResult = {
  city: string | null
  state: string | null
  stateCode: string | null
  zip: string | null
  lat: number | null
  lng: number | null
}

const cache = new Map<string, { r: GeoIpResult; at: number }>()
const TTL = 60 * 60 * 1000

const PRIVATE = /^(127\.|::1$|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::ffff:)/

function clientIp(req: NextRequest): string | null {
  const fwd = req.headers.get('x-forwarded-for')
  const ip = fwd ? fwd.split(',')[0].trim() : req.headers.get('x-real-ip')
  if (!ip || PRIVATE.test(ip)) return null
  return ip
}

const NULL_RESULT: GeoIpResult = { city: null, state: null, stateCode: null, zip: null, lat: null, lng: null }

export async function GET(req: NextRequest) {
  const ip = clientIp(req)
  if (!ip) return NextResponse.json(NULL_RESULT)

  const hit = cache.get(ip)
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.r)

  try {
    // ip-api.com: free, HTTP-only (server-side call is fine), 45 req/min per origin.
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,city,regionName,region,zip,lat,lon`,
      { signal: AbortSignal.timeout(3000), cache: 'no-store' },
    )
    const d = await res.json()
    if (d.status !== 'success') throw new Error('geoip failed')
    const r: GeoIpResult = {
      city: typeof d.city === 'string' ? d.city || null : null,
      state: typeof d.regionName === 'string' ? d.regionName || null : null,
      stateCode: typeof d.region === 'string' ? d.region || null : null,
      zip: typeof d.zip === 'string' ? d.zip || null : null,
      lat: typeof d.lat === 'number' && Number.isFinite(d.lat) ? d.lat : null,
      lng: typeof d.lon === 'number' && Number.isFinite(d.lon) ? d.lon : null,
    }
    cache.set(ip, { r, at: Date.now() })
    return NextResponse.json(r)
  } catch {
    return NextResponse.json(NULL_RESULT)
  }
}
