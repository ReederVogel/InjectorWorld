import crypto from 'crypto'

/**
 * Proof that the caller submitting thumbs-up/down actually received the answer
 * being rated.
 *
 * THE PROBLEM THIS SOLVES.
 *
 * /api/assistant/feedback took a `logId` straight from the request body and ran
 * `payload.update({ collection: 'assistant-logs', id: logId, overrideAccess: true })`.
 * No authentication (the assistant is anonymous by design, so there is no user to
 * check), no ownership test, and overrideAccess on. Any caller could set the
 * feedback flag on any log row by guessing or enumerating ids.
 *
 * The damage from that is genuinely small — it is a rating field — but the shape
 * is an insecure direct object reference, and the assistant-logs table is what
 * the monthly budget cap and the per-IP daily cap are computed from. Treating a
 * write into it as unauthenticated-and-unvalidated is the wrong default to leave
 * lying around.
 *
 * HOW IT WORKS.
 *
 * The chat route already streams a `{ type: 'logged', logId }` event once the
 * exchange is recorded. It now also emits a signature over that id. The client
 * hands both back, and the feedback route recomputes the signature: matching
 * proves the id came from us in this exchange rather than being picked by the
 * caller. No new storage, no session, nothing for the client to understand.
 *
 * This mirrors the HMAC already used for outreach unsubscribe links in
 * lib/outreach.ts. Keeping one pattern for "unauthenticated caller proves it
 * holds a token we issued" is deliberate.
 */
function secret(): string {
  return process.env.PAYLOAD_SECRET || 'dev-secret'
}

export function signFeedbackToken(logId: string): string {
  return crypto
    .createHmac('sha256', secret())
    .update(`assistant-feedback:${logId}`)
    .digest('hex')
    .slice(0, 32)
}

/**
 * Constant-time verification. `timingSafeEqual` throws on a length mismatch, so
 * the length is checked first and a wrong-length signature is simply rejected.
 */
export function verifyFeedbackToken(logId: string, sig: string): boolean {
  if (!logId || !sig) return false
  const expected = signFeedbackToken(logId)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
