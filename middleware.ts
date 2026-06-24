import { NextRequest, NextResponse } from 'next/server'

const BLOCKED_UAS = [
  'python-requests',
  'Scrapy',
  'scrapy',
  'Go-http-client',
  'libwww-perl',
  'curl/7',
  'wget/',
]

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/api/')) {
    const ua = req.headers.get('user-agent') || ''
    if (BLOCKED_UAS.some((s) => ua.includes(s))) {
      return new NextResponse('Forbidden', { status: 403 })
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
