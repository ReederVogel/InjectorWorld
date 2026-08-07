import { NextRequest, NextResponse } from 'next/server'
import { checkOrigin } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const expired = new Date(0)
const secure = process.env.NODE_ENV === 'production'

export async function POST(req: NextRequest) {
  // Lowest-stakes CSRF in the app — the worst outcome is somebody gets signed
  // out — but it is still a state change driven by a cross-site request, and
  // every other write route here is origin-checked. Consistency is the point:
  // an unchecked write route reads as intentional to the next person.
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const response = NextResponse.json(
    { success: true },
    { headers: { 'Cache-Control': 'no-store' } },
  )

  response.cookies.set('payload-token', '', {
    path: '/',
    expires: expired,
    maxAge: 0,
    httpOnly: true,
    sameSite: 'lax',
    secure,
  })

  return response
}
