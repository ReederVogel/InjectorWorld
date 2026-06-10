/**
 * Clinic merit ranking v1 — the clinic-side sibling of lib/merit.ts.
 *
 * Before Phase 5, clinics were ordered by review count alone. This gives clinics
 * a real, explainable, tunable score so they rank on the same philosophy as
 * providers (quality + evidence + completeness), and can be blended with distance
 * in unified search (lib/ranking.ts).
 *
 * Pure + deterministic. Adjust CLINIC_MERIT_WEIGHTS to retune; nothing else needs
 * to change.
 */
import type { DirectoryClinic } from './location-queries'

export const CLINIC_MERIT_WEIGHTS = {
  /** Aggregate patient rating (0–5 normalised to 0–1). Strongest signal. */
  rating: 2.0,
  /** log10(reviewCount + 1) saturating at MAX_REVIEWS. Diminishing returns. */
  reviewCount: 1.5,
  /** Fraction of key profile fields populated (photo, tagline, year, providers). */
  completeness: 1.0,
  penalties: {
    /** No photo: converts poorly, signals an incomplete record. */
    noPhoto: 0.5,
  },
} as const

const MAX_REVIEWS = 1000

function scoreRating(c: DirectoryClinic): number {
  if (!c.aggregateRating) return 0
  return Math.min(c.aggregateRating, 5) / 5
}

function scoreReviewCount(c: DirectoryClinic): number {
  const n = c.aggregateRatingCount ?? 0
  return Math.log10(n + 1) / Math.log10(MAX_REVIEWS + 1)
}

function scoreCompleteness(c: DirectoryClinic): number {
  const checks = [
    !!c.photoUrl,
    typeof c.tagline === 'string' && c.tagline.trim().length > 0,
    !!c.yearEstablished && c.yearEstablished > 0,
    c.providerCount > 0,
  ]
  return checks.filter(Boolean).length / checks.length
}

/** Merit score >= 0. Higher is better. */
export function computeClinicMeritScore(c: DirectoryClinic): number {
  const w = CLINIC_MERIT_WEIGHTS
  let score = 0
  score += scoreRating(c) * w.rating
  score += scoreReviewCount(c) * w.reviewCount
  score += scoreCompleteness(c) * w.completeness
  if (!c.photoUrl) score -= w.penalties.noPhoto
  return Math.max(score, 0)
}

/** Sort comparator: higher clinic merit first. */
export function byClinicMeritDesc(a: DirectoryClinic, b: DirectoryClinic): number {
  return computeClinicMeritScore(b) - computeClinicMeritScore(a)
}
