import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@/payload.config'
import { newsletterUnsubscribeSig } from '@/lib/newsletter-email'

export const dynamic = 'force-dynamic'

/**
 * One-click unsubscribe (CAN-SPAM).
 *
 * Accepts two link shapes:
 *
 *   ?email=<addr>&sig=<hmac>   preferred. See newsletterUnsubscribeUrl().
 *   ?token=<confirmToken>      legacy.
 *
 * THE LEGACY PATH IS KEPT ON PURPOSE. Unsubscribe links live in inboxes
 * indefinitely, and every newsletter already sent carries the token form. Dropping
 * it would break the unsubscribe mechanism on mail that is already delivered,
 * which is both a bad experience and the exact thing CAN-SPAM requires to keep
 * working. New mail uses the signed form; this branch retires by itself as old
 * mail ages out.
 *
 * Unsubscribing is deliberately forgiving in one direction only: it always
 * succeeds from the recipient's point of view, and it never reveals whether an
 * address is on the list. Both matter — an endpoint that answers "not found"
 * differently from "unsubscribed" is a subscriber-enumeration oracle.
 */
export async function GET(req: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'
  const params = req.nextUrl.searchParams

  const email = (params.get('email') || '').trim().toLowerCase()
  const sig = params.get('sig') || ''
  const token = params.get('token') || ''

  let where: Where | null = null

  if (email && sig) {
    if (sig !== newsletterUnsubscribeSig(email)) {
      return NextResponse.redirect(`${siteUrl}/newsletter/unsubscribed?error=invalid`, {
        headers: { 'Referrer-Policy': 'no-referrer' },
      })
    }
    where = { email: { equals: email } }
  } else if (token.length >= 10) {
    where = { confirmToken: { equals: token } }
  }

  if (!where) {
    return NextResponse.redirect(`${siteUrl}/newsletter/unsubscribed?error=invalid`, {
      headers: { 'Referrer-Policy': 'no-referrer' },
    })
  }

  try {
    const payload = await getPayload({ config })
    const result = await payload.find({
      collection: 'subscribers',
      where,
      limit: 1,
      overrideAccess: true,
    })

    const sub = result.docs[0] as { id: string | number; status?: string } | undefined

    // No match, or already unsubscribed: both land on the same confirmation page.
    // A distinct "we could not find you" answer would let anybody test whether a
    // given address is subscribed, one request at a time.
    if (sub && sub.status !== 'unsubscribed') {
      await payload.update({
        collection: 'subscribers',
        id: sub.id,
        overrideAccess: true,
        data: {
          status: 'unsubscribed',
          unsubscribedAt: new Date().toISOString(),
        } as never,
      })
    }
  } catch (err) {
    console.error('[newsletter/unsubscribe] failed:', err)
    return NextResponse.redirect(`${siteUrl}/newsletter/unsubscribed?error=retry`, {
      headers: { 'Referrer-Policy': 'no-referrer' },
    })
  }

  return NextResponse.redirect(`${siteUrl}/newsletter/unsubscribed`, {
    headers: { 'Referrer-Policy': 'no-referrer' },
  })
}
