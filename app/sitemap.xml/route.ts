import { buildSitemapIndex, XML_HEADERS } from '@/lib/sitemap-xml'
import {
  SITEMAP_GROUPS,
  SITEMAP_SHARD_SIZE,
  getSitemapGroupCounts,
} from '@/lib/page-index/queries'

/**
 * Sitemap INDEX. Tiny -- it only lists the child sitemaps; the url data is served
 * by /sitemaps/[type], each loading just its own shard so no single request holds
 * the whole registry in memory.
 *
 * The child list is now COMPUTED rather than hardcoded, because a group can need
 * more than one child: Google caps a sitemap at 50,000 urls and the registry
 * holds ~92k rows, so `clinics` alone will span two shards once its rollout is
 * done. A group with zero indexed urls is omitted entirely -- during a slow
 * manual rollout most groups are legitimately empty, and advertising an empty
 * child just wastes crawl budget.
 *
 * Consequence worth being clear about: immediately after the queue reset this
 * index is empty, because nothing has been batched in yet. That is correct, not a
 * regression.
 */
export const revalidate = 3600

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'

export async function GET() {
  const counts = await getSitemapGroupCounts()

  const children: string[] = []
  for (const group of Object.keys(SITEMAP_GROUPS)) {
    const total = counts[group] ?? 0
    if (total === 0) continue
    const shards = Math.ceil(total / SITEMAP_SHARD_SIZE)
    for (let i = 0; i < shards; i++) {
      // Shard 0 keeps the bare name so existing links stay valid.
      children.push(`${siteUrl}/sitemaps/${i === 0 ? group : `${group}-${i}`}`)
    }
  }

  return new Response(buildSitemapIndex(children), { headers: XML_HEADERS })
}
