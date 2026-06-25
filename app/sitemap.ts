import type { MetadataRoute } from 'next'
import { getAllGuideSlugs } from '@/lib/guide-queries'
import { getAllNewsSlugs } from '@/lib/news-queries'
import { getAllProviderParams } from '@/lib/provider-queries'
import { getAllClinicParams } from '@/lib/clinic-queries'
import { getIndexedPagePaths } from '@/lib/page-index/queries'
import { bodyAreas } from '@/lib/body-areas-data'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'

// Regenerate hourly so a page scan (new indexed pages) shows up without a redeploy.
export const revalidate = 3600

function url(path: string): string {
  return `${siteUrl}${path}`
}

// Priority by auto-page type. Service-city money pages rank highest.
const PAGE_PRIORITY: Record<string, number> = {
  'service-city': 0.9,
  'city-hub': 0.8,
  'service-pillar': 0.8,
  'service-state': 0.7,
  'state-hub': 0.7,
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const [guideSlugs, newsSlugs, providerParams, clinicParams, indexedPages] =
    await Promise.all([
      getAllGuideSlugs().catch(() => [] as string[]),
      getAllNewsSlugs().catch(() => [] as string[]),
      getAllProviderParams().catch(() => [] as { state: string; city: string; slug: string }[]),
      getAllClinicParams().catch(() => [] as { state: string; city: string; slug: string }[]),
      getIndexedPagePaths().catch(() => [] as { path: string; pageType: string; updatedAt: string }[]),
    ])

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: url('/'), lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    // /injectors is parked (noindex) until the verified-injector directory is live.
    { url: url('/clinics'), lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: url('/states'), lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: url('/services'), lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: url('/guides'), lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: url('/news'), lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: url('/how-we-verify'), lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: url('/editorial-standards'), lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: url('/medical-advisory'), lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: url('/about'), lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: url('/list-your-practice'), lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: url('/contact'), lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: url('/privacy'), lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: url('/terms'), lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: url('/hipaa'), lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]

  // Body area education pages
  const bodyAreaPages: MetadataRoute.Sitemap = bodyAreas.map((a) => ({
    url: url(`/treatments/${a.slug}`),
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

  // Guide pages
  const guidePages: MetadataRoute.Sitemap = guideSlugs.map((s) => ({
    url: url(`/guides/${s}`),
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }))

  // News article pages
  const newsPages: MetadataRoute.Sitemap = newsSlugs.map((s) => ({
    url: url(`/news/${s}`),
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.75,
  }))

  // Provider profiles — /injectors/[state]/[city]/[slug]
  const providerPages: MetadataRoute.Sitemap = providerParams.map((p) => ({
    url: url(`/injectors/${p.state}/${p.city}/${p.slug}`),
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  // Clinic profiles — /clinics/[state]/[city]/[slug]
  const clinicPages: MetadataRoute.Sitemap = clinicParams.map((c) => ({
    url: url(`/clinics/${c.state}/${c.city}/${c.slug}`),
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  // Auto service/location pages — ONLY those that have data and are indexed
  // (driven by the page-index scan). This replaces the old treatment×city
  // explosion so empty pages never enter the sitemap.
  const autoPages: MetadataRoute.Sitemap = indexedPages.map((p) => ({
    url: url(p.path),
    lastModified: p.updatedAt ? new Date(p.updatedAt) : now,
    changeFrequency: 'weekly' as const,
    priority: PAGE_PRIORITY[p.pageType] ?? 0.6,
  }))

  return [
    ...staticPages,
    ...bodyAreaPages,
    ...guidePages,
    ...newsPages,
    ...providerPages,
    ...clinicPages,
    ...autoPages,
  ]
}
