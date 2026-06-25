import type { MetadataRoute } from 'next'
import { getSiteConfigRaw } from '@/lib/site-config-queries'

export const dynamic = 'force-dynamic'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const { siteNoindex } = await getSiteConfigRaw()

  if (siteNoindex) {
    // Pre-launch: block all crawlers
    return {
      rules: [{ userAgent: '*', disallow: ['/'] }],
      host: siteUrl,
    }
  }

  // Live: normal rules — allow everything except admin/api internals
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/api/search/suggest'],
        disallow: ['/admin/', '/api/', '/_next/', '/search?*'],
      },
      { userAgent: 'GPTBot', allow: '/', disallow: ['/admin/', '/api/'] },
      { userAgent: 'ClaudeBot', allow: '/', disallow: ['/admin/', '/api/'] },
      { userAgent: 'PerplexityBot', allow: '/', disallow: ['/admin/', '/api/'] },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}
