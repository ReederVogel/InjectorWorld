import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { sendWelcomeEmail } from '@/lib/newsletter-email'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'

  if (!token || token.length < 10) {
    return NextResponse.redirect(`${siteUrl}/newsletter/confirmed?error=invalid`)
  }

  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'subscribers',
    where: { confirmToken: { equals: token } },
    limit: 1,
    overrideAccess: true,
  })

  if (!result.docs.length) {
    return NextResponse.redirect(`${siteUrl}/newsletter/confirmed?error=notfound`)
  }

  const sub = result.docs[0] as any

  if (sub.status === 'confirmed') {
    // Idempotent: already confirmed
    return NextResponse.redirect(`${siteUrl}/newsletter/confirmed`)
  }

  if (sub.status === 'unsubscribed') {
    return NextResponse.redirect(`${siteUrl}/newsletter/confirmed?error=unsubscribed`)
  }

  await payload.update({
    collection: 'subscribers',
    id: sub.id,
    overrideAccess: true,
    data: {
      status: 'confirmed',
      confirmedAt: new Date().toISOString(),
    } as any,
  })

  const unsubscribeUrl = `${siteUrl}/api/newsletter/unsubscribe?token=${token}`
  await sendWelcomeEmail({ to: sub.email, name: sub.name, unsubscribeUrl })

  return NextResponse.redirect(`${siteUrl}/newsletter/confirmed`)
}
