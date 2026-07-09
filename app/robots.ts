import type { MetadataRoute } from 'next'
import { getSiteConfigRaw } from '@/lib/site-config-queries'

export const dynamic = 'force-dynamic'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const { siteNoindex } = await getSiteConfigRaw()

  // Pre-launch and live both allow crawling. Blocking crawl via robots.txt
  // Disallow would stop bots from ever fetching a page to see its noindex
  // meta tag (SiteRobotsTag) -- Google can then index a bare URL with no
  // content if it's discovered elsewhere. Crawl-allowed + meta-noindex is
  // the reliable way to keep pages out of search while pre-launch.
  const rules: MetadataRoute.Robots['rules'] = [
    {
      userAgent: '*',
      allow: ['/api/search/suggest'],
      disallow: ['/admin/', '/api/', '/_next/', '/search?*'],
    },
    { userAgent: 'GPTBot', allow: '/', disallow: ['/admin/', '/api/'] },
    { userAgent: 'ClaudeBot', allow: '/', disallow: ['/admin/', '/api/'] },
    { userAgent: 'PerplexityBot', allow: '/', disallow: ['/admin/', '/api/'] },
    { userAgent: 'SiteAuditBot', allow: '/' },
  ]

  return siteNoindex
    ? { rules, host: siteUrl }
    : { rules, sitemap: `${siteUrl}/sitemap.xml`, host: siteUrl }
}
