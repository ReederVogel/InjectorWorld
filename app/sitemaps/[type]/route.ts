import { buildUrlset, XML_HEADERS, type SitemapUrl } from '@/lib/sitemap-xml'
import { getAllGuideSlugs } from '@/lib/guide-queries'
import { getAllNewsSlugs } from '@/lib/news-queries'
import { getAllProviderParams } from '@/lib/provider-queries'
import { getAllClinicParams } from '@/lib/clinic-queries'
import { getIndexedPagePaths } from '@/lib/page-index/queries'
import { bodyAreas } from '@/lib/body-areas-data'

// Each child sitemap loads ONLY its own dataset. This is the key memory fix:
// the old single sitemap pulled every clinic + provider + auto-page into one
// array in one request, which spiked the heap past the container limit.
export const revalidate = 3600

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'
const url = (path: string) => `${siteUrl}${path}`

const PAGE_PRIORITY: Record<string, number> = {
  'service-city': 0.9,
  'city-hub': 0.8,
  'service-pillar': 0.8,
  'service-state': 0.7,
  'state-hub': 0.7,
}

async function buildPages(): Promise<SitemapUrl[]> {
  const now = new Date().toISOString()
  const staticPaths: Array<[string, string, number]> = [
    ['/', 'daily', 1.0],
    ['/clinics', 'daily', 0.9],
    ['/states', 'weekly', 0.8],
    ['/services', 'weekly', 0.9],
    ['/brands', 'weekly', 0.9],
    ['/guides', 'weekly', 0.8],
    ['/news', 'daily', 0.8],
    ['/how-we-verify', 'monthly', 0.6],
    ['/editorial-standards', 'monthly', 0.5],
    ['/medical-advisory', 'monthly', 0.6],
    ['/about', 'monthly', 0.5],
    ['/list-your-practice', 'monthly', 0.7],
    ['/contact', 'monthly', 0.4],
    ['/privacy', 'yearly', 0.3],
    ['/terms', 'yearly', 0.3],
    ['/hipaa', 'yearly', 0.3],
  ]
  const pages: SitemapUrl[] = staticPaths.map(([p, changefreq, priority]) => ({
    loc: url(p),
    lastmod: now,
    changefreq,
    priority,
  }))
  for (const a of bodyAreas) {
    pages.push({ loc: url(`/treatments/${a.slug}`), lastmod: now, changefreq: 'monthly', priority: 0.6 })
  }
  return pages
}

async function buildGuides(): Promise<SitemapUrl[]> {
  const now = new Date().toISOString()
  const slugs = await getAllGuideSlugs().catch(() => [] as string[])
  return slugs.map((s) => ({ loc: url(`/guides/${s}`), lastmod: now, changefreq: 'monthly', priority: 0.8 }))
}

async function buildNews(): Promise<SitemapUrl[]> {
  const now = new Date().toISOString()
  const slugs = await getAllNewsSlugs().catch(() => [] as string[])
  return slugs.map((s) => ({ loc: url(`/news/${s}`), lastmod: now, changefreq: 'weekly', priority: 0.75 }))
}

async function buildClinics(): Promise<SitemapUrl[]> {
  const now = new Date().toISOString()
  const params = await getAllClinicParams().catch(() => [] as { state: string; city: string; slug: string }[])
  return params.map((c) => ({
    loc: url(`/clinics/${c.state}/${c.city}/${c.slug}`),
    lastmod: now,
    changefreq: 'weekly',
    priority: 0.7,
  }))
}

async function buildProviders(): Promise<SitemapUrl[]> {
  const now = new Date().toISOString()
  const params = await getAllProviderParams().catch(() => [] as { state: string; city: string; slug: string }[])
  return params.map((p) => ({
    loc: url(`/injectors/${p.state}/${p.city}/${p.slug}`),
    lastmod: now,
    changefreq: 'weekly',
    priority: 0.7,
  }))
}

async function buildAuto(): Promise<SitemapUrl[]> {
  const now = new Date().toISOString()
  const pages = await getIndexedPagePaths().catch(
    () => [] as { path: string; pageType: string; updatedAt: string }[],
  )
  return pages.map((p) => ({
    loc: url(p.path),
    lastmod: p.updatedAt || now,
    changefreq: 'weekly',
    priority: PAGE_PRIORITY[p.pageType] ?? 0.6,
  }))
}

const BUILDERS: Record<string, () => Promise<SitemapUrl[]>> = {
  pages: buildPages,
  guides: buildGuides,
  news: buildNews,
  clinics: buildClinics,
  providers: buildProviders,
  auto: buildAuto,
}

// Intentionally no generateStaticParams: these must NOT pre-render at build time
// (the clinics/providers datasets are large and would add build-side memory).
// They render on first request and cache for `revalidate` seconds.

export async function GET(_req: Request, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params
  const builder = BUILDERS[type.replace(/\.xml$/i, '')]
  if (!builder) return new Response('Not found', { status: 404 })

  const urls = await builder()
  return new Response(buildUrlset(urls), { headers: XML_HEADERS })
}
