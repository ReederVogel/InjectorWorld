import { buildUrlset, XML_HEADERS, type SitemapUrl } from '@/lib/sitemap-xml'
import {
  SITEMAP_GROUPS,
  getIndexedPathsForGroup,
  type SitemapRow,
} from '@/lib/page-index/queries'
import { staticPageFor } from '@/lib/page-index/static-pages'

/**
 * One sharded sitemap child, e.g. /sitemaps/clinics or /sitemaps/clinics-1.
 *
 * Every child now reads from ONE source: `page_index` rows with indexed = true.
 * Previously each child called a different collection query, which is how the
 * clinics child ended up emitting zero urls -- it reused
 * `getAllClinicParams()`, a build-time PRE-RENDER selector filtered on
 * `noindex = false`, and all 39,669 published clinics carry noindex = true (that
 * flag is a build-memory budget, not an SEO decision). So the biggest url family
 * on the site was never submitted to Google while its pages were meta-indexable.
 * Reading the registry removes the whole class of bug: if a url is indexed here,
 * it is in the sitemap, and the page's own robots tag resolves from the same row.
 *
 * Each child loads only its own shard, so no request ever materialises the whole
 * registry (that combined load was the original runtime OOM spike).
 */
export const revalidate = 3600

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'
const url = (path: string) => `${siteUrl}${path}`

// Relative weight per page type. Deeper pages answer a more specific query, so
// they carry more weight than the pillar that aggregates them.
const PAGE_PRIORITY: Record<string, number> = {
  'service-city': 0.9,
  'brand-city-directory': 0.8,
  'city-hub': 0.8,
  'service-pillar': 0.8,
  'service-state': 0.7,
  'state-hub': 0.7,
  'brand-pillar': 0.7,
  'brand-state': 0.6,
  clinic: 0.7,
  guide: 0.8,
  news: 0.75,
  question: 0.6,
}

const CHANGEFREQ: Record<string, string> = {
  clinic: 'weekly',
  guide: 'monthly',
  news: 'weekly',
  question: 'monthly',
  'service-city': 'weekly',
  'brand-city-directory': 'weekly',
  'city-hub': 'weekly',
  'state-hub': 'weekly',
  'service-state': 'weekly',
  'brand-state': 'weekly',
  'service-pillar': 'weekly',
  'brand-pillar': 'weekly',
}

function toUrl(row: SitemapRow): SitemapUrl {
  // Static routes carry hand-tuned changefreq/priority from the shared list;
  // everything else is derived from its page type.
  const staticMeta = row.pageType === 'static' ? staticPageFor(row.path) : undefined
  return {
    loc: url(row.path),
    lastmod: row.updatedAt,
    changefreq: staticMeta?.changefreq ?? CHANGEFREQ[row.pageType] ?? 'weekly',
    priority: staticMeta?.priority ?? PAGE_PRIORITY[row.pageType] ?? 0.6,
  }
}

/**
 * Parse `clinics-3` into group `clinics`, shard 3. A bare `clinics` is shard 0,
 * so existing links to the unsharded names keep working.
 */
function parseType(raw: string): { group: string; shard: number } | null {
  const name = raw.replace(/\.xml$/i, '')
  const match = /^(.*?)-(\d+)$/.exec(name)
  const group = match ? match[1] : name
  const shard = match ? parseInt(match[2], 10) : 0
  if (!SITEMAP_GROUPS[group] || !Number.isFinite(shard) || shard < 0) return null
  return { group, shard }
}

export async function GET(_req: Request, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params
  const parsed = parseType(type)
  if (!parsed) return new Response('Not found', { status: 404 })

  const rows = await getIndexedPathsForGroup(parsed.group, parsed.shard)
  return new Response(buildUrlset(rows.map(toUrl)), { headers: XML_HEADERS })
}

// Intentionally no generateStaticParams: these must NOT pre-render at build time
// (the clinic dataset is large and would add build-side memory). They render on
// first request and cache for `revalidate` seconds.
