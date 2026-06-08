// Single source of truth for which markets (states/cities) are live + indexable.
// Read by: homepage Browse-by-State, catch-all router generateMetadata, and the
// sitemap. Do NOT re-derive liveness anywhere else — import from here.

/** Locked launch states (Phase 3). 2-letter state codes. */
export const LAUNCH_STATE_CODES = ['CA', 'TX', 'NY', 'FL'] as const

type MarketFlags = {
  isLive?: boolean | null
  noindex?: boolean | null
}

/** A market is live only when explicitly switched on in admin. Default false. */
export function isMarketLive(loc: MarketFlags | null | undefined): boolean {
  return loc?.isLive === true
}

/**
 * A market page is indexable ONLY when it is live AND not flagged noindex.
 * `isLive` is the master switch: a non-live ("coming soon") market is never
 * indexable, even if its `noindex` flag was left off by mistake. The `noindex`
 * flag is a fine-grained override for live markets you want to temporarily hide.
 */
export function isMarketIndexable(loc: MarketFlags | null | undefined): boolean {
  return isMarketLive(loc) && loc?.noindex !== true
}

/**
 * Whether a market page should be kept out of search indexes.
 * True for any non-live market (thin "coming soon" pages) and for live markets
 * explicitly flagged noindex. CLAUDE.md decision: thin coming-soon pages are
 * noindex to avoid an SEO penalty.
 */
export function isMarketNoindex(loc: MarketFlags | null | undefined): boolean {
  return !isMarketIndexable(loc)
}

/**
 * Next.js Metadata.robots block for a thin/coming-soon page.
 * `follow: true` so crawlers still follow the links onward to live markets even
 * though this page itself is not indexed (standard practice for thin pages).
 */
export const NOINDEX_ROBOTS = { index: false, follow: true } as const
