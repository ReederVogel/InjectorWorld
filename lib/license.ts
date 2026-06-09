/**
 * Honest license labelling.
 *
 * We only claim "License verified" when we actually hold a state-board
 * verification URL for the provider. Without that record we say
 * "License on file" (a neutral statement, not a verification claim).
 *
 * The board record itself is linked from the provider profile (a "Verify"
 * link), so any "License verified" claim is checkable by the visitor. This
 * keeps the directory's verification claim defensible everywhere it appears.
 */
export function licenseClaim(verificationUrl?: string | null): string {
  return verificationUrl ? 'License verified' : 'License on file'
}
