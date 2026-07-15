import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { outreachUnsubscribeSig } from '@/lib/outreach'

export const dynamic = 'force-dynamic'

/**
 * One-click unsubscribe for claim-invite outreach emails (CAN-SPAM).
 * Link format: /api/outreach/unsubscribe?email=<addr>&sig=<hmac>
 * The HMAC (keyed with PAYLOAD_SECRET) stops third parties from
 * unsubscribing addresses they do not own. Marks every ClaimInvite for the
 * address as 'unsubscribed' — the outreach sender skips those forever.
 */

function page(title: string, body: string): NextResponse {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} | injector.world</title></head>
<body style="font-family:system-ui,sans-serif;background:#F7F8FA;margin:0;padding:48px 20px;">
  <div style="max-width:420px;margin:0 auto;background:#fff;border:1px solid #E2E8F0;border-radius:16px;padding:32px;text-align:center;">
    <p style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#94A3B8;margin:0 0 12px;">injector.world</p>
    <h1 style="font-size:22px;color:#0B1B34;margin:0 0 12px;">${title}</h1>
    <p style="font-size:15px;line-height:1.6;color:#475569;margin:0;">${body}</p>
  </div>
</body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
  )
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const email = (url.searchParams.get('email') || '').trim().toLowerCase()
  const sig = url.searchParams.get('sig') || ''

  if (!email || !sig || sig !== outreachUnsubscribeSig(email)) {
    return page('Invalid link', 'This unsubscribe link is invalid or incomplete. If you keep receiving emails, contact support@injector.world.')
  }

  try {
    const payload = await getPayload({ config })
    const existing = await payload.find({
      collection: 'claim-invites',
      where: { email: { equals: email } },
      limit: 100,
      depth: 0,
      overrideAccess: true,
    })

    for (const doc of existing.docs) {
      if ((doc as any).status !== 'unsubscribed') {
        await payload.update({
          collection: 'claim-invites',
          id: doc.id,
          data: { status: 'unsubscribed' },
          overrideAccess: true,
        })
      }
    }
  } catch (err) {
    console.error('[outreach/unsubscribe] failed:', err)
    return page('Something went wrong', 'We could not process your request. Please try again or contact support@injector.world.')
  }

  return page('You are unsubscribed', 'You will not receive any more claim invitations from injector.world at this address.')
}
