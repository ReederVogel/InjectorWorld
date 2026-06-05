/**
 * Merit ranking v1 — deterministic, explainable, tunable.
 *
 * Adjust MERIT_WEIGHTS and re-deploy to change ranking behaviour.
 * Nothing here makes a DB call; all computation is pure.
 *
 * Score formula (all sub-scores normalised to [0, 1] before weighting):
 *   rating       × w.rating
 *   reviewCount  × w.reviewCount
 *   completeness × w.completeness
 *   recency      × w.recency
 *   responseRate × w.responseRate
 *   minus penalties for unverified license or missing photo
 */
import type { DirectoryProvider } from './location-queries'

// ─── Tunable weights ─────────────────────────────────────────────────────────
// Sensible v1 defaults. The founder can adjust these numbers without touching
// any other code; the sort will automatically reflect the new weights on the
// next ISR revalidation.

export const MERIT_WEIGHTS = {
  /**
   * Patient aggregate rating (0–5, normalised to 0–1).
   * Highest-weight signal: a 5-star provider beats a 2-star provider by 2.0 pts.
   */
  rating: 2.0,

  /**
   * log10(reviewCount + 1) normalised by log10(MAX_REVIEWS + 1).
   * Diminishing returns: 1 review → ~0.08, 10 reviews → ~0.35, 100 → 0.67, 1000 → 1.0.
   * Prevents a single 5-star review from outranking 500 good reviews.
   */
  reviewCount: 1.5,

  /**
   * Fraction of key profile fields populated (photo, bio, startingPrice,
   * treatments listed, languages listed). Max 1.0.
   * Incentivises providers to complete their profile after claiming.
   */
  completeness: 1.0,

  /**
   * Recency: scraped/updated in the last 90 days scores 1.0, fades to 0 at
   * 2 years. Placeholder 0 when updatedAt is unavailable.
   */
  recency: 0.5,

  /**
   * Booking response rate [0–1]. Placeholder 0 until we track bookings.
   */
  responseRate: 0.3,

  penalties: {
    /**
     * Deducted when licenseStateCode or licenseNumber is blank
     * (i.e., the profile has not been verified against the state board).
     */
    unverifiedLicense: 1.5,

    /**
     * Deducted when profilePhotoUrl is blank.
     * A profile without a photo converts poorly and signals an incomplete record.
     */
    noPhoto: 0.5,
  },
} as const

// ─── Internal constants ───────────────────────────────────────────────────────

/** Review counts above this saturate the log score at 1.0. */
const MAX_REVIEWS = 1000

/** Days considered "freshly verified" — recency score = 1.0. */
const RECENCY_FRESH_DAYS = 90

/** Days after which the recency score drops to 0. */
const RECENCY_STALE_DAYS = 730

// ─── Extended provider shape ─────────────────────────────────────────────────
// DirectoryProvider has most fields we need. bio and updatedAt are optional
// additions supplied by mapProvider; they gracefully degrade to 0 if absent.

export type MeritProvider = DirectoryProvider & {
  /** Provider bio text (used in completeness score). */
  bio?: string
  /** ISO date string from Payload's updatedAt (used in recency score). */
  updatedAt?: string
}

// ─── Sub-scorers (all return a value in [0, 1]) ───────────────────────────────

function scoreRating(p: MeritProvider): number {
  if (!p.aggregateRating) return 0
  return Math.min(p.aggregateRating, 5) / 5
}

function scoreReviewCount(p: MeritProvider): number {
  const n = p.aggregateRatingCount ?? 0
  return Math.log10(n + 1) / Math.log10(MAX_REVIEWS + 1)
}

function scoreCompleteness(p: MeritProvider): number {
  const checks = [
    !!p.profilePhotoUrl,
    typeof p.bio === 'string' && p.bio.trim().length > 0,
    !!p.startingPrice && p.startingPrice > 0,
    p.treatments.length > 0,
    p.languages.length > 0,
  ]
  return checks.filter(Boolean).length / checks.length
}

function scoreRecency(p: MeritProvider): number {
  if (!p.updatedAt) return 0
  const ageMs = Date.now() - new Date(p.updatedAt).getTime()
  const ageDays = ageMs / (1_000 * 60 * 60 * 24)
  if (ageDays <= RECENCY_FRESH_DAYS) return 1
  if (ageDays >= RECENCY_STALE_DAYS) return 0
  return 1 - (ageDays - RECENCY_FRESH_DAYS) / (RECENCY_STALE_DAYS - RECENCY_FRESH_DAYS)
}

function scoreResponseRate(_p: MeritProvider): number {
  // Placeholder until booking-response tracking is in place.
  return 0
}

// ─── Main exports ─────────────────────────────────────────────────────────────

/**
 * Returns a merit score >= 0. Higher is better.
 * Pure and deterministic: calling twice with the same input returns the same result.
 */
export function computeMeritScore(p: MeritProvider): number {
  const w = MERIT_WEIGHTS
  let score = 0
  score += scoreRating(p) * w.rating
  score += scoreReviewCount(p) * w.reviewCount
  score += scoreCompleteness(p) * w.completeness
  score += scoreRecency(p) * w.recency
  score += scoreResponseRate(p) * w.responseRate

  // Penalties (subtracted, never below 0)
  const licenseOk = !!p.licenseStateCode && !!p.licenseNumber
  if (!licenseOk) score -= w.penalties.unverifiedLicense
  if (!p.profilePhotoUrl) score -= w.penalties.noPhoto

  return Math.max(score, 0)
}

/** Sort comparator: higher merit score first. */
export function byMeritDesc(a: MeritProvider, b: MeritProvider): number {
  return computeMeritScore(b) - computeMeritScore(a)
}

/**
 * Reorders a provider list applying admin organic pins then merit score.
 *
 * Layout produced (top to bottom):
 *   1. Admin-pinned providers (in ascending rank order, 1 then 2 then 3).
 *   2. Remaining providers sorted by merit score descending.
 *
 * Providers already shown as sponsored cards (excludeIds) are removed from
 * the organic list entirely to prevent duplication.
 *
 * @param providers  Full provider list for the scope (fetched from DB).
 * @param pinnedIds  Map of provider id → organic pin rank (from organic-pin Promotions).
 * @param excludeIds Provider ids already shown as sponsored cards above this list.
 */
export function applyMeritOrder(
  providers: DirectoryProvider[],
  pinnedIds: Map<string, number>,
  excludeIds: Set<string>,
): DirectoryProvider[] {
  // Remove sponsored providers from the organic section entirely.
  const organic = providers.filter((p) => !excludeIds.has(p.id))

  // Pinned providers: match by id and sort by rank.
  const pinned = organic
    .filter((p) => pinnedIds.has(p.id))
    .sort((a, b) => (pinnedIds.get(a.id) ?? 99) - (pinnedIds.get(b.id) ?? 99))

  // Tail: everything not pinned, sorted by merit score.
  const tail = organic
    .filter((p) => !pinnedIds.has(p.id))
    .sort(byMeritDesc)

  return [...pinned, ...tail]
}
