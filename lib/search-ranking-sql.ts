/**
 * The search ranking formula, expressed in SQL. OPT-IN, OFF BY DEFAULT.
 *
 * WHY THIS EXISTS
 *
 * `clinicCandidates()` in search-queries.ts selects candidates with
 * `... LIMIT 3000` and NO `ORDER BY`, then ranks those 3,000 in JavaScript with
 * `rankClinics()`. For any query matching more than 3,000 clinics that is not a
 * ranking, it is a ranking of an arbitrary slice: Postgres returns whichever
 * 3,000 rows the plan happened to produce first, and the other matches are never
 * considered. Measured on staging 2026-09-04:
 *
 *   q=botox        51,074 match, 3,000 considered, UI reported "3000"
 *   q=lip filler   14,862 match, 3,000 considered
 *   q=juvederm     11,799 match, 3,000 considered
 *
 * The visible symptom was that "botox" led with clinics in Peoria, Surprise and
 * Scottsdale, which are not the best-rated Botox clinics in the country, only
 * the ones the scan reached first.
 *
 * WHAT THIS FIXES IT WITH
 *
 * `rankClinics()` blends three deterministic, column-derived numbers. Every one
 * of them can be computed in SQL, so the database can order the FULL match set
 * by the exact same score and hand back the genuine top N.
 *
 * The expressions below mirror lib/clinic-merit.ts and lib/ranking.ts term for
 * term. They are the contract: if either of those files changes its weights or
 * its shape, this must change with it, or SQL will pre-select on one formula
 * while JS re-sorts on another.
 *
 * JS `rankClinics()` STILL RUNS and still has the final word. SQL only decides
 * which rows are fetched. That is deliberate: a float rounding difference
 * between Postgres numeric and JS double could reorder two near-identical
 * scores, and the fetch margin (see RANKED_FETCH_MARGIN in search-queries.ts)
 * keeps any such difference far away from the rows a visitor actually sees.
 *
 * ENABLING IT
 *
 *   SEARCH_RANKED_SQL=1
 *
 * Unset keeps the existing arbitrary-slice behaviour. Prove the change first:
 *
 *   npx tsx --env-file=.env.staging scripts/search-baseline.ts compare before after
 */
import { METERS_PER_MILE } from './search-sql'
import { CLINIC_MERIT_WEIGHTS } from './clinic-merit'
import { RANKING_WEIGHTS } from './ranking'

/** MAX_REVIEWS from lib/clinic-merit.ts. Kept in sync by the test below it. */
const MAX_REVIEWS = 1000

/**
 * `computeClinicMeritScore()` from lib/clinic-merit.ts, as SQL.
 *
 * Term by term:
 *   scoreRating       LEAST(rating,5)/5            * weights.rating
 *   scoreReviewCount  log10(n+1)/log10(MAX+1)      * weights.reviewCount
 *                     (written with ln() since log10(a)/log10(b) == ln(a)/ln(b))
 *   scoreCompleteness (photo + tagline + providers)/3 * weights.completeness
 *   penalty           -weights.penalties.noPhoto when there is no photo
 *   then Math.max(score, 0)
 *
 * `providerCount` is the third completeness check. search-queries.ts calls
 * `mapClinic(c, slugMap, 0, ...)`, hard-coding it to 0, so that check is always
 * false here and contributes nothing. It is written out as `+ 0` below rather
 * than dropped, so the divisor stays 3 and the parallel to the JS stays visible.
 *
 * `has_photo` is used rather than a join to clinics_clinic_photo_urls. Verified
 * on staging 2026-09-04: of 57,591 published clinics, 47,046 have the flag AND
 * photo rows, 10,545 have neither, and ZERO disagree in either direction.
 */
export function clinicMeritSql(alias = 'c'): string {
  const a = alias ? `${alias}.` : ''
  const w = CLINIC_MERIT_WEIGHTS
  return `GREATEST(0,
      (LEAST(COALESCE(${a}aggregate_rating, 0), 5) / 5.0) * ${w.rating}
    + (ln(COALESCE(${a}aggregate_rating_count, 0) + 1) / ln(${MAX_REVIEWS + 1}.0)) * ${w.reviewCount}
    + (( (CASE WHEN ${a}has_photo THEN 1 ELSE 0 END)
       + (CASE WHEN ${a}tagline IS NOT NULL AND btrim(${a}tagline) <> '' THEN 1 ELSE 0 END)
       + 0 )::numeric / 3.0) * ${w.completeness}
    - (CASE WHEN ${a}has_photo THEN 0 ELSE ${w.penalties.noPhoto} END)
  )`
}

/**
 * `rankClinics()`'s blended score, as SQL.
 *
 *   merit
 *   + weights.distance * (1 / (1 + miles / distanceDecayMiles))   when geocoded
 *   + weights.text     * GREATEST(ts_rank, 0)                     when free text
 *
 * `distExpr` arrives in METRES (both clinicDistanceMeters and the Haversine
 * fallback return metres), and `distanceScore()` takes MILES, so it is divided
 * by METERS_PER_MILE here. Getting that conversion wrong would not error; it
 * would quietly flatten the distance term to near zero, so it is spelled out.
 *
 * Pass null for a term that does not apply to this query, exactly as
 * `rankClinics(..., { useDistance, useText })` switches them off in JS.
 */
export function blendedScoreSql(
  alias: string,
  opts: { distExpr?: string | null; tsRankExpr?: string | null } = {},
): string {
  const parts = [clinicMeritSql(alias)]

  if (opts.distExpr) {
    const miles = `((${opts.distExpr}) / ${METERS_PER_MILE})`
    parts.push(
      `(${RANKING_WEIGHTS.distance} * (1.0 / (1.0 + GREATEST(0, ${miles}) / ${RANKING_WEIGHTS.distanceDecayMiles}.0)))`,
    )
  }

  if (opts.tsRankExpr) {
    parts.push(`(${RANKING_WEIGHTS.text} * GREATEST(0, ${opts.tsRankExpr}))`)
  }

  return `(${parts.join(' + ')})`
}

/** Whether SQL-side ranking + a real total are enabled. Off unless SEARCH_RANKED_SQL=1. */
export function rankedSqlEnabled(): boolean {
  return process.env.SEARCH_RANKED_SQL === '1'
}
