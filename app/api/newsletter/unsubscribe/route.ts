import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'

  if (!token || token.length < 10) {
    return NextResponse.redirect(`${siteUrl}/newsletter/unsubscribed?error=invalid`)
  }

  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'subscribers',
    where: { confirmToken: { equals: token } },
    limit: 1,
    overrideAccess: true,
  })

  if (!result.docs.length) {
    return NextResponse.redirect(`${siteUrl}/newsletter/unsubscribed?error=notfound`)
  }

  const sub = result.docs[0] as any

  if (sub.status === 'unsubscribed') {
    // Already unsubscribed: idempotent
    return NextResponse.redirect(`${siteUrl}/newsletter/unsubscribed`)
  }

  await payload.update({
    collection: 'subscribers',
    id: sub.id,
    overrideAccess: true,
    data: {
      status: 'unsubscribed',
      unsubscribedAt: new Date().toISOString(),
    } as any,
  })

  return NextResponse.redirect(`${siteUrl}/newsletter/unsubscribed`)
}
