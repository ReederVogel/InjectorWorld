import { cache } from 'react'
import { getPayloadInstance } from './payload-server'

export type SiteConfig = {
  siteNoindex: boolean
}

const SAFE_DEFAULT: SiteConfig = { siteNoindex: true }

async function fetchSiteConfig(): Promise<SiteConfig> {
  try {
    const payload = await getPayloadInstance()
    const config = await payload.findGlobal({ slug: 'site-config' })
    return { siteNoindex: config?.siteNoindex ?? true }
  } catch {
    return SAFE_DEFAULT
  }
}

// React-cached version for server components (request-scoped)
export const getSiteConfig = cache(fetchSiteConfig)

// Non-cached version for robots.ts route handler (force-dynamic context, no React cache)
export const getSiteConfigRaw = fetchSiteConfig
