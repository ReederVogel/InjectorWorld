'use client'

import { useEffect, useState } from 'react'
import { box } from '../ui/styles'
import { DashboardNewsletterPanel } from '../DashboardNewsletterPanel'
import { DashboardNewsSendPanel } from '../DashboardNewsSendPanel'

/** Hosts the confirmed-subscriber count fetch the two broadcast panels need. */
export function BroadcastPanel() {
  const [confirmedSubs, setConfirmedSubs] = useState<number>(0)

  useEffect(() => {
    async function loadSubscribers() {
      try {
        const res = await fetch('/api/subscribers?where[status][equals]=confirmed&limit=1&depth=0', { credentials: 'include' })
        const json = await res.json()
        setConfirmedSubs(json.totalDocs ?? 0)
      } catch { /* non-fatal */ }
    }
    loadSubscribers()
  }, [])

  return (
    <>
      <div id="newsletter" style={box}>
        <strong style={{ fontSize: 15 }}>Newsletter broadcast</strong>
        <div style={{ fontSize: 13, opacity: 0.8, margin: '4px 0 14px' }}>
          Send a plain-text email to confirmed subscribers. An unsubscribe link is added automatically.
          Set RESEND_API_KEY to send real mail (falls back to console log).
        </div>
        <DashboardNewsletterPanel confirmedCount={confirmedSubs} />
      </div>

      <div id="news-send" style={box}>
        <strong style={{ fontSize: 15 }}>Send news article to subscribers</strong>
        <div style={{ fontSize: 13, opacity: 0.8, margin: '4px 0 14px' }}>
          Notify subscribers about a published news article. The email is auto-composed from the article title and excerpt.
        </div>
        <DashboardNewsSendPanel confirmedCount={confirmedSubs} />
      </div>
    </>
  )
}
