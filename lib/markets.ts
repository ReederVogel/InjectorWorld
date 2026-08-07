// Single source of truth for which markets (states/cities) are live, and for
// the data-quality bar a listing page must clear to enter the indexing queue.
// Read by: homepage Browse-by-State, catch-all router generateMetadata, the
// page-index scan, and the sitemap. Do NOT re-derive either value elsewhere.

/**
 * Every URL family the site publishes. `page_index` holds one row per URL,
 * keyed by `pageKey`, and this union is the row's `pageType`.
 *
 * The first eight are COMPUTED pages: they exist because clinic data exists for
 * a service/brand/location combination, so their quality bar is a clinic count.
 * The rest are ENTITY pages: one URL per document in a collection (or a
 * hardcoded static route), so their bar is just "is the source published".
 */
export const COMPUTED_PAGE_TYPES = [
  'service-pillar', 'service-state', 'service-city',
  'state-hub', 'city-hub',
  'brand-pillar', 'brand-state', 'brand-city-directory',
] as const

export const ENTITY_PAGE_TYPES = [
  'clinic', 'guide', 'news', 'static', 'provider', 'question',
] as const

export const PAGE_TYPES = [...COMPUTED_PAGE_TYPES, ...ENTITY_PAGE_TYPES] as const

export type ComputedPageType = (typeof COMPUTED_PAGE_TYPES)[number]
export type EntityPageType = (typeof ENTITY_PAGE_TYPES)[number]
export type PageType = (typeof PAGE_TYPES)[number]

export function isComputedPageType(t: string): t is ComputedPageType {
  return (COMPUTED_PAGE_TYPES as readonly string[]).includes(t)
}

/**
 * Default minimum published clinics a listing page needs before it shows up in
 * the indexing queue as "ready to batch". Kept as a named export because it is
 * the fallback for any page type missing from INDEX_THRESHOLDS.
 */
export const MIN_CLINICS_TO_INDEX = 5

/**
 * Per-type quality bar, in published clinics.
 *
 * This is a SOFT gate. It decides whether a row is offered up by default in the
 * batch-index tool ("Index next N"), not whether the row is allowed to be
 * indexed. An admin can deliberately batch a below-threshold page. The hard,
 * non-overridable gate is `publishable` (source doc published/approved) --
 * see collections/PageIndex.ts.
 *
 * Rationale for the shape: the deeper the page, the more specific the query it
 * answers, so a thin one still earns its place. Pillars aggregate a whole
 * catalogue, so a thin pillar is a genuinely bad result and needs more behind it.
 *
 * Entity pages carry 1: they are gated by publish/approval status, not volume.
 *
 * These numbers are a starting point and are meant to be tuned. Change them
 * here only -- nothing else should hardcode a threshold.
 */
export const INDEX_THRESHOLDS: Record<PageType, number> = {
  // Computed pages: clinic-count gated.
  'service-city': 5,
  'brand-city-directory': 5,
  'city-hub': 3,
  'service-state': 10,
  'brand-state': 10,
  'state-hub': 10,
  'service-pillar': 25,
  'brand-pillar': 25,
  // Entity pages: publish/approval gated, so the count bar is nominal.
  clinic: 1,
  guide: 1,
  news: 1,
  static: 1,
  provider: 1,
  question: 1,
}

/** Threshold for a page type, falling back to MIN_CLINICS_TO_INDEX. */
export function thresholdFor(pageType: string): number {
  return INDEX_THRESHOLDS[pageType as PageType] ?? MIN_CLINICS_TO_INDEX
}

type MarketFlags = {
  isLive?: boolean | null
}

/**
 * A market is "live" (shows the real directory, not a Coming Soon placeholder)
 * whenever it has at least one published clinic -- computed automatically by
 * the page-index scan, not a manual admin launch decision.
 *
 * Note this is deliberately NOT the same thing as indexable. Market liveness
 * stayed automatic; indexing became a manual batch decision (2026-08-08).
 */
export function isMarketLive(loc: MarketFlags | null | undefined): boolean {
  return loc?.isLive === true
}

/**
 * Next.js Metadata.robots block for a page that is not (yet) indexed.
 * `follow: true` so crawlers still walk the links onward to indexed pages even
 * though this page itself is not indexed (standard practice for thin pages, and
 * what keeps internal-link discovery working during a slow indexing rollout).
 */
export const NOINDEX_ROBOTS = { index: false, follow: true } as const
