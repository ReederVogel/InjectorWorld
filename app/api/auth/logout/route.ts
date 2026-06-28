import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const expired = new Date(0)
const secure = process.env.NODE_ENV === 'production'

export async function POST() {
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
