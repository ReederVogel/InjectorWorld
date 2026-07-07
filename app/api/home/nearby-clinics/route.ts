import { NextRequest, NextResponse } from 'next/server'
import { getNearbyClinics } from '@/lib/nearby-clinics'

export async function GET(req: NextRequest) {
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
