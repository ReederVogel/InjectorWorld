import { getSiteConfig } from '@/lib/site-config-queries'

/**
 * Renders <meta name="robots" content="noindex,follow"> when site is in pre-launch mode.
 * `follow` (not `nofollow`) so crawlers can still walk internal links and audit the
 * full site structure pre-launch -- only indexing is blocked, not link discovery.
 */
export async function SiteRobotsTag() {
  const { siteNoindex } = await getSiteConfig()
  if (!siteNoindex) return null
  return <meta name="robots" content="noindex,follow" />
}
