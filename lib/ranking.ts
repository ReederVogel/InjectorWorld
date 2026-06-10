/**
 * Unified search ranking (ROADMAP Phase 5).
 *
 * One explainable ordering for providers AND clinics:
 *   1. Sponsored (admin-pinned) items float to the top, by rank.
 *   2. Everyone else is ordered by a blend of merit + distance.
 *
 * Merit comes from lib/merit.ts (providers) and lib/clinic-merit.ts (clinics).
 * Distance only contributes when the search was geocoded (a point + radius);
 * for text/treatment searches there is no distance, so it falls back to pure
 * merit. Weights are tunable here, mirroring the MERIT_WEIGHTS pattern.
 */
import { computeMeritScore } from './merit'
import { computeClinicMeritScore } from './clinic-merit'
import type { SearchProvider, SearchClinic } from './search-queries'

export const RANKING_WEIGHTS = {
  /**
   * How much proximity matters relative to merit in a geocoded search.
   * distanceScore is in [0, 1]; merit scores typically run ~0–5, so a weight of
   * 2.5 lets a very close result meaningfully outrank a slightly-better-but-far
   * one without letting distance dominate quality entirely.
   */
  distance: 2.5,
  /**
   * Distance half-curve constant in miles: distanceScore = 1 / (1 + miles/D).
   * At D miles the proximity score is 0.5; at 0 miles it is 1.0. With the 25-mile
   * default radius, D=12 keeps near results clearly ahead of edge-of-radius ones.
   */
  distanceDecayMiles: 12,
} as const

/** Proximity score in [0, 1]; 1 at the search point, decaying with distance. */
export function distanceScore(miles: number | undefined): number {
  if (miles == null || !Number.isFinite(miles)) return 0
  return 1 / (1 + Math.max(0, miles) / RANKING_WEIGHTS.distanceDecayMiles)
}

/**
 * Rank providers: pinned (sponsored) first by rank, then merit (+ distance when
 * the search is geocoded) descending. Pure; does not mutate the input.
 */
export function rankProviders(
  providers: SearchProvider[],
  opts: { pinnedRanks?: Map<string, number>; useDistance?: boolean } = {},
): SearchProvider[] {
  const pins = opts.pinnedRanks ?? new Map<string, number>()
  const blended = (p: SearchProvider) =>
    computeMeritScore(p) + (opts.useDistance ? RANKING_WEIGHTS.distance * distanceScore(p.distanceMiles) : 0)

  const pinned = providers
    .filter((p) => pins.has(p.id))
    .sort((a, b) => (pins.get(a.id) ?? 99) - (pins.get(b.id) ?? 99))
  const tail = providers.filter((p) => !pins.has(p.id)).sort((a, b) => blended(b) - blended(a))
  return [...pinned, ...tail]
}

/**
 * Rank clinics: merit (+ distance when geocoded) descending. Pure.
 * Clinics carry no sponsored slots in this model (sponsorship is provider-based).
 */
export function rankClinics(
  clinics: SearchClinic[],
  opts: { useDistance?: boolean } = {},
): SearchClinic[] {
  const blended = (c: SearchClinic) =>
    computeClinicMeritScore(c) + (opts.useDistance ? RANKING_WEIGHTS.distance * distanceScore(c.distanceMiles) : 0)
  return [...clinics].sort((a, b) => blended(b) - blended(a))
}
