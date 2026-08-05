import { cache } from 'react'
import { getPayloadInstance } from './payload-server'

export type SiteConfig = {
  siteNoindex: boolean
  heroAiSearchEnabled: boolean
  metaTitle: string | null
  metaDescription: string | null
  ogImageUrl: string | null
}

const SAFE_DEFAULT: SiteConfig = {
  siteNoindex: true,
  heroAiSearchEnabled: false,
  metaTitle: null,
  metaDescription: null,
  ogImageUrl: null,
}

async function fetchSiteConfig(): Promise<SiteConfig> {
  try {
    const payload = await getPayloadInstance()
    const config = await payload.findGlobal({ slug: 'site-config', depth: 1 })
    const ogImage = config?.ogImage
    return {
      siteNoindex: config?.siteNoindex ?? true,
      heroAiSearchEnabled: config?.heroAiSearchEnabled ?? false,
      metaTitle: config?.metaTitle || null,
      metaDescription: config?.metaDescription || null,
      ogImageUrl: ogImage && typeof ogImage === 'object' ? ogImage.url ?? null : null,
    }
  } catch {
    return SAFE_DEFAULT
  }
}

// React-cached version for server components (request-scoped)
export const getSiteConfig = cache(fetchSiteConfig)

// Non-cached version for robots.ts route handler (force-dynamic context, no React cache)
export const getSiteConfigRaw = fetchSiteConfig
