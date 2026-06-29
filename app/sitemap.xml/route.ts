import { buildSitemapIndex, XML_HEADERS } from '@/lib/sitemap-xml'

// Sitemap INDEX. Tiny — just lists the child sitemaps. The actual URL data is
// served by /sitemaps/[type], each of which loads only its own dataset so no
// single request holds every clinic + provider + auto-page in memory at once.
export const revalidate = 3600

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'

const CHILDREN = ['pages', 'guides', 'news', 'clinics', 'providers', 'auto'] as const

export async function GET() {
  const xml = buildSitemapIndex(CHILDREN.map((type) => `${siteUrl}/sitemaps/${type}`))
  return new Response(xml, { headers: XML_HEADERS })
}
