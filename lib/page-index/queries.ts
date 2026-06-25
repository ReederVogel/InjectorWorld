import { cache } from 'react'
import { getPayloadInstance } from '../payload-server'
import { NOINDEX_ROBOTS } from '../markets'

/**
 * Robots block for an auto-generated service/location page, driven by the
 * `page-index` collection (written by the page scan). A page is indexable only
 * when it has a row whose `indexed` is true (data present + not force-noindex,
 * or force-index). Untracked paths (no row = no data) are noindex.
 *
 * Returns `{}` to spread into Metadata when indexable, or `{ robots }` when not.
 */
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
    if (row && row.indexed === true) return {}
    return { robots: NOINDEX_ROBOTS }
  } catch {
    // If the lookup fails, fall back to indexable so we never accidentally hide a
    // page on a transient DB hiccup. (The sitemap still gates inclusion strictly.)
    return {}
  }
})

/** All indexed auto-generated pages, for the sitemap. */
export const getIndexedPagePaths = cache(async function getIndexedPagePaths(): Promise<
  { path: string; pageType: string; updatedAt: string }[]
> {
  const payload = await getPayloadInstance()
  const res = await payload.find({
    collection: 'page-index' as any,
    where: { indexed: { equals: true } },
    limit: 100000,
    depth: 0,
  })
  return (res.docs as any[]).map((r) => ({
    path: r.path,
    pageType: r.pageType,
    updatedAt: r.updatedAt ?? new Date().toISOString(),
  }))
})
