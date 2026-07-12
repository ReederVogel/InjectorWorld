'use client'

import { Suspense, useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { track, getSession } from '@/lib/analytics/client'

function BeaconInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const lastPathRef = useRef<string | null>(null)

  useEffect(() => {
    if (!pathname || lastPathRef.current === pathname) return
    lastPathRef.current = pathname

    // Referrer/UTM data is only meaningful the moment a session starts --
    // attaching it on every internal navigation would misattribute traffic
    // sources to whatever page the visitor happened to be on.
    const { isNew } = getSession()
    const data: { referrer?: string; utmSource?: string; utmMedium?: string; utmCampaign?: string } = {}
    if (isNew) {
      if (typeof document !== 'undefined' && document.referrer) data.referrer = document.referrer
      const utmSource = searchParams?.get('utm_source')
      const utmMedium = searchParams?.get('utm_medium')
      const utmCampaign = searchParams?.get('utm_campaign')
      if (utmSource) data.utmSource = utmSource
      if (utmMedium) data.utmMedium = utmMedium
      if (utmCampaign) data.utmCampaign = utmCampaign
    }

    track('pageview', { path: pathname, ...data })
  }, [pathname, searchParams])

  return null
}

/**
 * Fires a pageview on mount and on every client-side route change.
 * useSearchParams() opts a component out of static rendering unless wrapped
 * in Suspense -- without this boundary, mounting it in the root layout would
 * force every page in the app into dynamic rendering.
 */
export function AnalyticsBeacon() {
  return (
    <Suspense fallback={null}>
      <BeaconInner />
    </Suspense>
  )
}
