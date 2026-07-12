const DISABLED = process.env.NEXT_PUBLIC_ANALYTICS_DISABLED === 'true'

const VID_KEY = 'iw_vid'
const SID_KEY = 'iw_sid'
const SID_AT_KEY = 'iw_sid_at'
const SESSION_TIMEOUT_MS = 30 * 60 * 1000

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** Stable per-browser id, created once and kept in localStorage indefinitely. */
export function getVisitorId(): string {
  if (DISABLED || typeof window === 'undefined') return ''
  try {
    let vid = window.localStorage.getItem(VID_KEY)
    if (!vid) {
      vid = uuid()
      window.localStorage.setItem(VID_KEY, vid)
    }
    return vid
  } catch {
    return ''
  }
}

/**
 * Session id that rotates after 30 minutes of inactivity. `isNew` tells the
 * caller whether this call just started a fresh session (vs. extending an
 * existing one), so referrer/UTM data can be attached only once per session.
 */
export function getSession(): { sessionId: string; isNew: boolean } {
  if (DISABLED || typeof window === 'undefined') return { sessionId: '', isNew: false }
  try {
    const now = Date.now()
    const lastAt = Number(window.localStorage.getItem(SID_AT_KEY) || 0)
    let sid = window.localStorage.getItem(SID_KEY)
    let isNew = false
    if (!sid || !lastAt || now - lastAt > SESSION_TIMEOUT_MS) {
      sid = uuid()
      window.localStorage.setItem(SID_KEY, sid)
      isNew = true
    }
    window.localStorage.setItem(SID_AT_KEY, String(now))
    return { sessionId: sid, isNew }
  } catch {
    return { sessionId: '', isNew: false }
  }
}

export type TrackData = {
  path?: string
  entityType?: string
  entityId?: number
  referrer?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  meta?: Record<string, unknown>
}

/**
 * Fires an analytics event at /api/t. Never throws and never blocks the UI --
 * every failure mode (missing sendBeacon, network error, disabled flag,
 * SSR context) resolves to a silent no-op.
 */
export function track(type: string, data: TrackData = {}): void {
  if (DISABLED || typeof window === 'undefined') return
  try {
    const { sessionId } = getSession()
    const visitorId = getVisitorId()

    const body: Record<string, unknown> = {
      event_type: type,
      path: data.path ?? window.location.pathname,
      sessionId,
      visitorId,
    }
    if (data.entityType) body.entityType = data.entityType
    if (data.entityId) body.entityId = data.entityId
    if (data.referrer) body.referrer = data.referrer
    if (data.utmSource) body.utmSource = data.utmSource
    if (data.utmMedium) body.utmMedium = data.utmMedium
    if (data.utmCampaign) body.utmCampaign = data.utmCampaign
    if (data.meta) body.meta = data.meta

    const json = JSON.stringify(body)

    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([json], { type: 'text/plain' })
      if (navigator.sendBeacon('/api/t', blob)) return
    }

    fetch('/api/t', {
      method: 'POST',
      body: json,
      keepalive: true,
      headers: { 'Content-Type': 'text/plain' },
    }).catch(() => { /* analytics must never break the UI */ })
  } catch {
    /* analytics must never break the UI */
  }
}
