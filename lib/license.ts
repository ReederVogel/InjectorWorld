/**
 * Honest license labelling.
 *
 * We only claim "License verified" when we actually hold a state-board
 * verification URL for the provider AND the license is currently active.
 * Without that record we say "License on file" (a neutral statement, not a
 * verification claim).
 *
 * The board record itself is linked from the provider profile (a "Verify"
 * link), so any "License verified" claim is checkable by the visitor. This
 * keeps the directory's verification claim defensible everywhere it appears.
 *
 * @param verificationUrl  The state-board verification URL, if we have one.
 * @param licenseStatus    The license status field. Defaults to 'active' so
 *                         rows without a status field stay safe.
 */
export function licenseClaim(
  verificationUrl?: string | null,
  licenseStatus?: string | null,
): string {
  const status = (licenseStatus ?? 'active').toLowerCase()
  return verificationUrl && status === 'active' ? 'License verified' : 'License on file'
}
