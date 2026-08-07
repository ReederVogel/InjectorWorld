import crypto from 'crypto'

/**
 * Six-digit email verification codes.
 *
 * WHY THIS EXISTS RATHER THAN AN INLINE EXPRESSION.
 *
 * Three routes previously generated their own code with:
 *
 *     String(Math.floor(100000 + Math.random() * 900000))
 *
 * `Math.random()` is not a cryptographic generator. V8 implements it with
 * xorshift128+, a deterministic PRNG seeded once per context. Given enough
 * observed outputs, the internal state can be solved for, and once it is, every
 * subsequent value is predictable rather than merely guessable.
 *
 * That matters here specifically because the attacker can harvest outputs on
 * demand: the signup endpoint is public, so they can request codes for their own
 * addresses as many times as they like, recover the state, and then predict the
 * code issued to somebody else. The worst case is the claim flow, where the code
 * confirms control of the email address attached to a clinic listing.
 *
 * `crypto.randomInt` draws from the OS CSPRNG, so no number of observed outputs
 * reveals anything about the next one. The output format is identical (a
 * zero-padded six-digit string), so nothing downstream changes: same length,
 * same regex `^\d{6}$` in the verify routes, same UX.
 *
 * Keep every code in the product going through this function. A second inline
 * `Math.random()` somewhere is invisible in review, which is how the original
 * three copies survived as long as they did.
 */
export function generateVerificationCode(): string {
  // Upper bound is exclusive: this yields 100000-999999, always six digits.
  return String(crypto.randomInt(100000, 1000000))
}

/**
 * Constant-time comparison for a submitted code against the stored one.
 *
 * A plain `!==` returns as soon as it finds a differing character, so the time
 * it takes leaks how many leading characters matched. Over enough samples that
 * turns a 1-in-a-million guess into a digit-by-digit walk.
 *
 * The practical risk is low here (network jitter swamps the signal, and the
 * verify routes are rate limited per IP and per account), so treat this as
 * hygiene rather than a fix for a live hole. It costs nothing to be correct.
 *
 * Returns false rather than throwing when the lengths differ, since
 * `timingSafeEqual` requires equal-length buffers.
 */
export function verificationCodeMatches(submitted: string, stored: string | null | undefined): boolean {
  if (!stored) return false
  const a = Buffer.from(submitted)
  const b = Buffer.from(stored)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
