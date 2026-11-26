'use client'

import { useEffect } from 'react'
import { track } from '@/lib/analytics/client'

type Props = {
  type: string
  entityType?: string
  entityId?: number
}

/** Fires a single analytics event on mount. Renders nothing. */
export function TrackEvent({ type, entityType, entityId }: Props) {
  useEffect(() => {
    track(type, { entityType, entityId })
    // Intentionally fires once on mount only -- not on prop changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

/**
 * Records clicks on any element marked data-track-click="call|website|directions"
 * as an outbound_click for this entity (one delegated listener, so the links stay
 * server-rendered). Feeds the clinic owner's "Calls / website / directions" numbers.
 */
export function TrackClicks({ entityType, entityId }: { entityType: string; entityId: number }) {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.('[data-track-click]')
      const kind = el?.getAttribute('data-track-click')
      if (kind) track('outbound_click', { entityType, entityId, meta: { kind } })
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [entityType, entityId])

  return null
}
