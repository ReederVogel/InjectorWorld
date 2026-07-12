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
