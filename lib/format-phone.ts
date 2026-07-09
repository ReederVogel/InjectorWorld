/**
 * Clinic phone numbers were imported from mixed sources (raw scrapes, CSVs) and
 * are stored in inconsistent raw formats -- e.g. "14809874195" vs "+18325831676".
 * These helpers normalize at render time rather than migrating 17k+ DB rows.
 */

/** Normalizes any raw US phone string to E.164 (+1XXXXXXXXXX), or null if it doesn't look like a clean 10/11-digit US number. */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

/** Human-readable display format: "+1 (480) 987-4195". Falls back to the raw input if it isn't a clean US number. */
export function formatPhoneDisplay(raw: string | null | undefined): string | null {
  if (!raw) return null
  const e164 = toE164(raw)
  if (!e164) return raw
  const digits = e164.slice(2)
  return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

/** tel: href value -- E.164 when parseable, else a best-effort digits-only fallback so the link still works. */
export function toTelHref(raw: string | null | undefined): string | null {
  if (!raw) return null
  const e164 = toE164(raw)
  if (e164) return e164
  const digits = raw.replace(/\D/g, '')
  return digits ? `+${digits}` : null
}
