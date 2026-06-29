// Shared XML builders for the split sitemap. Each child sitemap loads ONLY its
// own dataset, so a single request never materializes every clinic + provider +
// auto-page at once (that combined load was the runtime OOM spike).

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export type SitemapUrl = {
  loc: string
  lastmod?: string
  changefreq?: string
  priority?: number
}

export function buildUrlset(urls: SitemapUrl[]): string {
  const body = urls
    .map((u) => {
      let entry = `<url><loc>${escapeXml(u.loc)}</loc>`
      if (u.lastmod) entry += `<lastmod>${u.lastmod}</lastmod>`
      if (u.changefreq) entry += `<changefreq>${u.changefreq}</changefreq>`
      if (u.priority != null) entry += `<priority>${u.priority}</priority>`
      return entry + `</url>`
    })
    .join('')
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`
}

export function buildSitemapIndex(locs: string[]): string {
  const now = new Date().toISOString()
  const body = locs
    .map((loc) => `<sitemap><loc>${escapeXml(loc)}</loc><lastmod>${now}</lastmod></sitemap>`)
    .join('')
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</sitemapindex>`
}

export const XML_HEADERS = {
  'Content-Type': 'application/xml; charset=utf-8',
} as const
