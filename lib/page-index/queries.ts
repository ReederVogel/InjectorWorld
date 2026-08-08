import { cache } from 'react'
import { getPayloadInstance } from '../payload-server'
import { NOINDEX_ROBOTS, type PageType } from '../markets'

/**
 * The read side of the url registry. Every page's robots meta tag and every
 * sitemap entry resolves through here, for every page type -- there is no second
 * mechanism.
 *
 * FAIL CLOSED. Under the old automatic model a missing row meant "no clinic data
 * yet" and a lookup failure fell back to indexable, on the theory that a DB hiccup
 * should not hide a good page. Both of those are now wrong: since 2026-08-08
 * nothing indexes until a human batches it in, so "no row" and "lookup failed"
 * both mean "we have not decided yet", and the safe answer to that is noindex.
 * Guessing indexable would leak un-reviewed urls into search, which is the exact
 * thing the manual rollout exists to prevent.
 */

/** Robots block for a url. Spread into Metadata: `{}` when indexed, `{ robots }` when not. */
export const getPageRobots = cache(async function getPageRobots(
  path: string,
): Promise<Record<string, unknown>> {
  try {
    const payload = await getPayloadInstance()
    const res = await payload.find({
      collection: 'page-index' as any,
      where: { path: { equals: path } },
      limit: 1,
      depth: 0,
    })
    const row = res.docs[0] as any
    return row?.indexed === true ? {} : { robots: NOINDEX_ROBOTS }
  } catch {
    return { robots: NOINDEX_ROBOTS }
  }
})

/**
 * Same decision, looked up by source document instead of by path.
 *
 * Entity pages (clinic/guide/news) know their own id for certain, but their path
 * is assembled from slugs that can drift -- a clinic whose city was re-mapped
 * would miss on a path lookup and silently go noindex. Keyed on the source doc,
 * that cannot happen.
 */
export const getEntityRobots = cache(async function getEntityRobots(
  sourceCollection: string,
  sourceId: string | number,
): Promise<Record<string, unknown>> {
  try {
    const payload = await getPayloadInstance()
    const res = await payload.find({
      collection: 'page-index' as any,
      where: {
        and: [
          { sourceCollection: { equals: sourceCollection } },
          { sourceId: { equals: String(sourceId) } },
        ],
      },
      limit: 1,
      depth: 0,
    })
    const row = res.docs[0] as any
    return row?.indexed === true ? {} : { robots: NOINDEX_ROBOTS }
  } catch {
    return { robots: NOINDEX_ROBOTS }
  }
})

// ── Sitemap ──────────────────────────────────────────────────────────────────

/**
 * Sitemap children are sharded. Google caps a single sitemap at 50,000 urls, and
 * the registry holds ~92k rows, so a full rollout would breach that. The old code
 * had a bare `LIMIT 20000` in the auto query, which would have silently truncated
 * the moment indexed rows crossed it -- no error, just missing pages.
 */
export const SITEMAP_SHARD_SIZE = 45_000

/** Which page types each sitemap child covers. */
export const SITEMAP_GROUPS: Record<string, PageType[]> = {
  pages: ['static'],
  guides: ['guide'],
  news: ['news'],
  questions: ['question'],
  clinics: ['clinic'],
  auto: [
    'service-pillar', 'service-state', 'service-city',
    'state-hub', 'city-hub',
    'brand-pillar', 'brand-state', 'brand-city-directory',
  ],
}

export type SitemapRow = { path: string; pageType: string; updatedAt: string }

/** How many indexed urls each group holds, so the index knows its shard count. */
export const getSitemapGroupCounts = cache(async function getSitemapGroupCounts(): Promise<
  Record<string, number>
> {
  const out: Record<string, number> = {}
  try {
    const payload = await getPayloadInstance()
    const pool = (payload.db as any).pool
    const res = await pool.query(
      `SELECT page_type::text AS type, count(*)::int AS n
         FROM page_index
        WHERE indexed = true
        GROUP BY 1`,
    )
    const byType = new Map<string, number>(res.rows.map((r: any) => [r.type, r.n]))
    for (const [group, types] of Object.entries(SITEMAP_GROUPS)) {
      out[group] = types.reduce((sum, t) => sum + (byType.get(t) ?? 0), 0)
    }
  } catch {
    // An empty index is a valid sitemap. Better to serve a short one than 500.
    for (const group of Object.keys(SITEMAP_GROUPS)) out[group] = 0
  }
  return out
})

/**
 * One shard of one group.
 *
 * Ordered by id, not updated_at: shards must not overlap or drop rows, and any
 * ordering key that mutates between two child requests can shift a row across a
 * shard boundary. id never changes.
 */
export async function getIndexedPathsForGroup(
  group: string,
  shard = 0,
): Promise<SitemapRow[]> {
  const types = SITEMAP_GROUPS[group]
  if (!types) return []

  try {
    const payload = await getPayloadInstance()
    const pool = (payload.db as any).pool
    const res = await pool.query(
      `SELECT path, page_type AS "pageType", updated_at AS "updatedAt"
         FROM page_index
        WHERE indexed = true
          AND page_type::text = ANY($1)
        ORDER BY id
        LIMIT $2 OFFSET $3`,
      [types, SITEMAP_SHARD_SIZE, shard * SITEMAP_SHARD_SIZE],
    )
    return res.rows.map((r: any) => ({
      path: r.path,
      pageType: r.pageType,
      updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
    }))
  } catch {
    return []
  }
}
