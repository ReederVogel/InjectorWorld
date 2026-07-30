'use client'

import { useState } from 'react'
import { track } from '@/lib/analytics/client'

/**
 * Share a clinic page: native share sheet where available (mobile),
 * copy-link fallback elsewhere. Fires a 'share' analytics event either way
 * so owners and admins can see share counts per clinic.
 */
export function ShareButton({
  clinicId,
  clinicName,
  className = '',
}: {
  clinicId: number
  clinicName: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    const url = typeof window !== 'undefined' ? window.location.href.split('#')[0] : ''
    if (!url) return

    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> }

    if (typeof nav.share === 'function') {
      try {
        await nav.share({ title: `${clinicName} | injector.world`, url })
        track('share', { entityType: 'clinic', entityId: clinicId, meta: { method: 'native' } })
      } catch {
        // User dismissed the share sheet — not a share, no event.
      }
      return
    }

    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      track('share', { entityType: 'clinic', entityId: clinicId, meta: { method: 'copy' } })
    } catch {
      // Clipboard unavailable (permissions/http) — quietly do nothing.
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label={`Share ${clinicName}`}
      className={`inline-flex min-h-11 items-center gap-2 rounded-control border border-border bg-surface-canvas px-4 py-2 text-body-sm font-semibold text-ink-primary transition hover:border-brand-accent ${className}`}
    >
      {copied ? (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
          Link copied
        </>
      ) : (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          Share
        </>
      )}
    </button>
  )
}
