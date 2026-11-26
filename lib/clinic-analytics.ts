import 'server-only'
import type { Payload } from 'payload'

/**
 * A clinic owner's numbers, straight from raw analytics.events (indexed on
 * entity_type, entity_id, ts: well under a millisecond per clinic). Not from
 * analytics.daily: that rollup only runs by hand and is empty on staging and prod.
 * Days are UTC.
 */
export type ClinicAnalytics = {
  days: number
  views: number
  visitors: number
  leads: number
  clicks: { call: number; website: number; directions: number }
  shares: number
  /** Elite only: views per day, oldest first, every day present. */
  series?: { day: string; views: number }[]
  /** Elite only: where the sessions that viewed this clinic started. */
  sources?: { label: string; sessions: number }[]
}

const DAY = 24 * 60 * 60 * 1000
const isoDay = (d: Date) => d.toISOString().slice(0, 10)

/** Groups a session's landing referrer into a source owners recognise. */
export function sourceLabel(referrer: string | null | undefined): string {
  if (!referrer) return 'Direct or unknown'
  let host: string
  try {
    host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return 'Direct or unknown'
  }
  const on = (...domains: string[]) => domains.some((d) => host === d || host.endsWith(`.${d}`))
  if (on('injector.world', 'ondigitalocean.app')) return 'injector.world'
  if (/(^|\.)google\.[a-z.]+$/.test(host)) return 'Google'
  if (on('bing.com', 'duckduckgo.com', 'yahoo.com', 'ecosia.org', 'search.brave.com')) return 'Other search engines'
  if (on('chatgpt.com', 'openai.com', 'perplexity.ai', 'claude.ai', 'gemini.google.com', 'copilot.microsoft.com')) return 'AI assistants'
  if (on('facebook.com', 'fb.com', 'instagram.com', 'tiktok.com', 't.co', 'twitter.com', 'x.com', 'linkedin.com', 'pinterest.com', 'reddit.com', 'youtube.com')) return 'Social media'
  return host
}

/** Top sources, the rest folded into "Other websites". */
export function groupSources(referrers: (string | null)[], top = 6): { label: string; sessions: number }[] {
  const counts = new Map<string, number>()
  for (const r of referrers) {
    const label = sourceLabel(r)
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([label, sessions]) => ({ label, sessions }))
  if (sorted.length <= top) return sorted
  const rest = sorted.slice(top - 1).reduce((n, s) => n + s.sessions, 0)
  return [...sorted.slice(0, top - 1), { label: 'Other websites', sessions: rest }]
}

export async function clinicAnalytics(payload: Payload, clinicId: number, days: number, full: boolean): Promise<ClinicAnalytics | null> {
  const pool = (payload.db as any).pool
  if (!pool) return null
  const today = new Date()
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - (days - 1) * DAY)
  try {
    const [counts, visitors, leads, series, sessions] = await Promise.all([
      pool.query(
        `SELECT event_type, meta->>'kind' AS kind, count(*)::int AS n
           FROM analytics.events
          WHERE entity_type = 'clinic' AND entity_id = $1 AND ts >= $2
          GROUP BY 1, 2`,
        [clinicId, start],
      ),
      pool.query(
        `SELECT count(DISTINCT visitor_id)::int AS n FROM analytics.events
          WHERE entity_type = 'clinic' AND entity_id = $1 AND event_type = 'clinic_view' AND ts >= $2`,
        [clinicId, start],
      ),
      payload.count({ collection: 'bookings', where: { and: [{ clinic: { equals: clinicId } }, { createdAt: { greater_than_equal: start.toISOString() } }] }, overrideAccess: true }),
      full
        ? pool.query(
            `SELECT to_char((ts AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS day, count(*)::int AS n
               FROM analytics.events
              WHERE entity_type = 'clinic' AND entity_id = $1 AND event_type = 'clinic_view' AND ts >= $2
              GROUP BY 1`,
            [clinicId, start],
          )
        : null,
      // Each session that viewed the clinic, with the referrer it landed with
      // (pageview carries one only on a session's first page).
      full
        ? pool.query(
            `WITH s AS (
               SELECT DISTINCT session_id FROM analytics.events
                WHERE entity_type = 'clinic' AND entity_id = $1 AND event_type = 'clinic_view'
                  AND ts >= $2 AND session_id IS NOT NULL AND session_id <> ''
                LIMIT 5000
             )
             SELECT (SELECT e.referrer FROM analytics.events e
                      WHERE e.session_id = s.session_id AND e.event_type = 'pageview'
                        AND e.referrer IS NOT NULL AND e.referrer <> ''
                      ORDER BY e.ts LIMIT 1) AS referrer
               FROM s`,
            [clinicId, start],
          )
        : null,
    ])

    const out: ClinicAnalytics = {
      days,
      views: 0,
      visitors: Number(visitors.rows[0]?.n ?? 0),
      leads: leads.totalDocs ?? 0,
      clicks: { call: 0, website: 0, directions: 0 },
      shares: 0,
    }
    for (const r of counts.rows as { event_type: string; kind: string | null; n: number }[]) {
      if (r.event_type === 'clinic_view') out.views += r.n
      else if (r.event_type === 'share') out.shares += r.n
      else if (r.event_type === 'outbound_click' && r.kind && r.kind in out.clicks) out.clicks[r.kind as keyof ClinicAnalytics['clicks']] += r.n
    }
    if (series) {
      const byDay = new Map((series.rows as { day: string; n: number }[]).map((r) => [r.day, r.n]))
      out.series = Array.from({ length: days }, (_, i) => {
        const day = isoDay(new Date(start.getTime() + i * DAY))
        return { day, views: byDay.get(day) ?? 0 }
      })
    }
    if (sessions) out.sources = groupSources((sessions.rows as { referrer: string | null }[]).map((r) => r.referrer))
    return out
  } catch (err) {
    payload.logger.error(`[clinic-analytics] ${clinicId}: ${(err as Error)?.message ?? err}`)
    return null
  }
}
