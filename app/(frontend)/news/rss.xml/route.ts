import { NextResponse } from 'next/server'
import { getLatestNewsForRss } from '@/lib/news-queries'

export const revalidate = 300
export const dynamic = 'force-static'

const CATEGORY_LABELS: Record<string, string> = {
  'treatment-update': 'Treatment Update',
  industry: 'Industry',
  company: 'Company',
  announcement: 'Announcement',
  'product-launch': 'Product Launch',
  research: 'Research',
  regulation: 'Regulation',
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'

  let items: Awaited<ReturnType<typeof getLatestNewsForRss>> = []
  try {
    items = await getLatestNewsForRss(20)
  } catch {
    // DB unavailable; return empty feed
  }

  const pubDate = (iso?: string) => {
    const d = iso ? new Date(iso) : new Date()
    return d.toUTCString()
  }

  const itemsXml = items
    .map(
      (item) => `
    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${siteUrl}/news/${escapeXml(item.slug)}</link>
      <guid isPermaLink="true">${siteUrl}/news/${escapeXml(item.slug)}</guid>
      <description>${escapeXml(item.excerpt)}</description>
      <pubDate>${pubDate(item.publishedAt)}</pubDate>
      <category>${escapeXml(CATEGORY_LABELS[item.category] ?? item.category)}</category>
    </item>`,
    )
    .join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>injector.world News</title>
    <link>${siteUrl}/news</link>
    <description>Treatment updates, industry news, and announcements from the aesthetics world. Curated by the injector.world editorial team.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/news/rss.xml" rel="self" type="application/rss+xml" />
    <image>
      <url>${siteUrl}/logo.png</url>
      <title>injector.world News</title>
      <link>${siteUrl}/news</link>
    </image>${itemsXml}
  </channel>
</rss>`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  })
}
