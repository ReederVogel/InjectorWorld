import { getSiteConfig } from '@/lib/site-config-queries'

/** Renders <meta name="robots" content="noindex,nofollow"> when site is in pre-launch mode. */
export async function SiteRobotsTag() {
  const { siteNoindex } = await getSiteConfig()
  if (!siteNoindex) return null
  return <meta name="robots" content="noindex,nofollow" />
}
