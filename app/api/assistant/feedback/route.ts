import { NextRequest, NextResponse } from 'next/server'
import { RateLimiter, checkOrigin, getIp } from '@/lib/rate-limit'
import { getPayloadInstance } from '@/lib/payload-server'
import { verifyFeedbackToken } from '@/lib/assistant/feedback-token'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Thumbs up/down on an assistant answer.
 *
 * Unauthenticated by necessity — the assistant itself is anonymous — which is
 * why this previously wrote to any `assistant-logs` row the caller named, with
 * `overrideAccess: true` and no rate limit. Two things now stand in the way:
 *
 *   1. An HMAC over the log id, issued by the chat stream that produced the
 *      answer (lib/assistant/feedback-token.ts). Holding a valid signature is
 *      proof the caller received this specific answer, which is the closest
 *      thing to ownership that exists in an anonymous flow.
 *   2. A rate limit, so even a caller replaying its own valid token cannot use
 *      this as a free write loop against the table that the assistant's monthly
 *      budget cap is computed from.
 */

// One rating per answer is the honest ceiling; 20/minute leaves room for a user
// rating several answers in a session while making bulk writes pointless.
const limiter = new RateLimiter(20, 60 * 1000)

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) {
    return NextResponse.json({ ok: false }, { status: 403 })
  }

  if (!(await limiter.check(`assistant-feedback:${getIp(req)}`))) {
    return NextResponse.json({ ok: false }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const raw = body as { logId?: unknown; sig?: unknown; value?: unknown }
  const logId = typeof raw?.logId === 'string' ? raw.logId : ''
  const sig = typeof raw?.sig === 'string' ? raw.sig : ''
  const value = raw?.value === 'up' || raw?.value === 'down' ? raw.value : null

  if (!logId || !value) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  if (!verifyFeedbackToken(logId, sig)) {
    // Deliberately the same generic body as every other failure here: telling a
    // caller "the id was fine but the signature was not" is a free oracle for
    // probing which log ids exist.
    return NextResponse.json({ ok: false }, { status: 403 })
  }

  try {
    const payload = await getPayloadInstance()
    await payload.update({
      collection: 'assistant-logs',
      id: logId,
      // overrideAccess: true — assistant-logs is staff-read-only, and this route
      // has no user to authorise. The signature check above is what authorises
      // the write, and it can only ever set `feedback` on the one row the caller
      // proved it received.
      overrideAccess: true,
      data: { feedback: value },
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
