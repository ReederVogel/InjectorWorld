// Single source of truth for which markets (states/cities) are live, and for
// the data-quality bar a listing page must clear to be indexable.
// Read by: homepage Browse-by-State, catch-all router generateMetadata, the
// page-index scan, and the sitemap. Do NOT re-derive either value elsewhere.

/**
 * Minimum published clinics a listing page (state/city hub, service page,
 * brand page) needs to be index-eligible. Below this it's still crawlable,
 * just noindex -- avoids indexing thin pages. No manual per-page review step:
 * the page-index scan computes this automatically for every page type.
 */
export const MIN_CLINICS_TO_INDEX = 5

type MarketFlags = {
  isLive?: boolean | null
}

/**
 * A market is "live" (shows the real directory, not a Coming Soon placeholder)
 * whenever it has at least one published clinic -- computed automatically by
 * the page-index scan, not a manual admin launch decision.
 */
export function isMarketLive(loc: MarketFlags | null | undefined): boolean {
  return loc?.isLive === true
}

/**
 * Next.js Metadata.robots block for a thin/coming-soon page.
 * `follow: true` so crawlers still follow the links onward to live markets even
 * though this page itself is not indexed (standard practice for thin pages).
 */
export const NOINDEX_ROBOTS = { index: false, follow: true } as const
