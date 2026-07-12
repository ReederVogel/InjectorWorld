import 'server-only'
import type { Payload } from 'payload'

export type RollupRange = { from: string; to: string } // 'YYYY-MM-DD', inclusive

export type RollupResult = {
  pageviews: number
  visitors: number
  pageviewsByPath: number
  clinicViews: number
  eventsByType: number
  visitorsByState: number
  visitorsByDevice: number
  pageviewsByReferrer: number
  deletedOldEvents: number
}

const RANGE_WHERE = `ts >= $1::date AND ts < ($2::date + interval '1 day')`

const PAGEVIEWS_SQL = `
  INSERT INTO analytics.daily (day, metric, dimension, value)
  SELECT date_trunc('day', ts)::date AS day, 'pageviews', '', count(*)
  FROM analytics.events
  WHERE event_type = 'pageview' AND ${RANGE_WHERE}
  GROUP BY 1
  ON CONFLICT (day, metric, dimension) DO UPDATE SET value = EXCLUDED.value
`

const VISITORS_SQL = `
  INSERT INTO analytics.daily (day, metric, dimension, value)
  SELECT date_trunc('day', ts)::date AS day, 'visitors', '', count(DISTINCT visitor_id)
  FROM analytics.events
  WHERE visitor_id IS NOT NULL AND ${RANGE_WHERE}
  GROUP BY 1
  ON CONFLICT (day, metric, dimension) DO UPDATE SET value = EXCLUDED.value
`

// Capped at the top 500 paths per day so a long tail of one-off URLs
// (typos, bot-probed paths that slipped past isBot, etc) can't blow up
// analytics.daily's row count.
const PAGEVIEWS_BY_PATH_SQL = `
  INSERT INTO analytics.daily (day, metric, dimension, value)
  SELECT day, 'pageviews_by_path', path, value FROM (
    SELECT date_trunc('day', ts)::date AS day, path, count(*) AS value,
           row_number() OVER (PARTITION BY date_trunc('day', ts)::date ORDER BY count(*) DESC) AS rn
    FROM analytics.events
    WHERE event_type = 'pageview' AND path IS NOT NULL AND ${RANGE_WHERE}
    GROUP BY 1, path
  ) ranked
  WHERE rn <= 500
  ON CONFLICT (day, metric, dimension) DO UPDATE SET value = EXCLUDED.value
`

const CLINIC_VIEWS_SQL = `
  INSERT INTO analytics.daily (day, metric, dimension, value)
  SELECT date_trunc('day', ts)::date AS day, 'clinic_views', entity_id::text, count(*)
  FROM analytics.events
  WHERE event_type = 'clinic_view' AND entity_id IS NOT NULL AND ${RANGE_WHERE}
  GROUP BY 1, entity_id
  ON CONFLICT (day, metric, dimension) DO UPDATE SET value = EXCLUDED.value
`

const EVENTS_BY_TYPE_SQL = `
  INSERT INTO analytics.daily (day, metric, dimension, value)
  SELECT date_trunc('day', ts)::date AS day, 'events_by_type', event_type, count(*)
  FROM analytics.events
  WHERE ${RANGE_WHERE}
  GROUP BY 1, event_type
  ON CONFLICT (day, metric, dimension) DO UPDATE SET value = EXCLUDED.value
`

const VISITORS_BY_STATE_SQL = `
  INSERT INTO analytics.daily (day, metric, dimension, value)
  SELECT date_trunc('day', ts)::date AS day, 'visitors_by_state', geo_state, count(DISTINCT visitor_id)
  FROM analytics.events
  WHERE geo_state IS NOT NULL AND visitor_id IS NOT NULL AND ${RANGE_WHERE}
  GROUP BY 1, geo_state
  ON CONFLICT (day, metric, dimension) DO UPDATE SET value = EXCLUDED.value
`

const VISITORS_BY_DEVICE_SQL = `
  INSERT INTO analytics.daily (day, metric, dimension, value)
  SELECT date_trunc('day', ts)::date AS day, 'visitors_by_device', device, count(DISTINCT visitor_id)
  FROM analytics.events
  WHERE device IS NOT NULL AND visitor_id IS NOT NULL AND ${RANGE_WHERE}
  GROUP BY 1, device
  ON CONFLICT (day, metric, dimension) DO UPDATE SET value = EXCLUDED.value
`

// Host extracted from the referrer URL in SQL. Capped at the top 100 hosts
// per day, same long-tail protection as PAGEVIEWS_BY_PATH_SQL.
const PAGEVIEWS_BY_REFERRER_SQL = `
  INSERT INTO analytics.daily (day, metric, dimension, value)
  SELECT day, 'pageviews_by_referrer', host, value FROM (
    SELECT date_trunc('day', ts)::date AS day,
           regexp_replace(regexp_replace(referrer, '^https?://(www\\.)?', ''), '/.*$', '') AS host,
           count(*) AS value,
           row_number() OVER (PARTITION BY date_trunc('day', ts)::date ORDER BY count(*) DESC) AS rn
    FROM analytics.events
    WHERE event_type = 'pageview' AND referrer IS NOT NULL AND referrer != '' AND ${RANGE_WHERE}
    GROUP BY 1, host
  ) ranked
  WHERE rn <= 100
  ON CONFLICT (day, metric, dimension) DO UPDATE SET value = EXCLUDED.value
`

const DELETE_OLD_EVENTS_SQL = `DELETE FROM analytics.events WHERE ts < now() - interval '90 days'`

/**
 * Aggregates raw analytics.events into analytics.daily for [from, to]
 * (inclusive). Every INSERT recomputes its rows via ON CONFLICT DO UPDATE,
 * so re-running the same range is safe and idempotent. Finishes by pruning
 * events older than 90 days -- daily rollups already retain the history.
 */
export async function runRollup(payload: Payload, range: RollupRange): Promise<RollupResult> {
  const pool = (payload.db as any).pool
  if (!pool) throw new Error('No Postgres pool on payload.db')

  const { from, to } = range
  const run = async (sql: string): Promise<number> => {
    const res = await pool.query(sql, [from, to])
    return res.rowCount ?? 0
  }

  const pageviews = await run(PAGEVIEWS_SQL)
  const visitors = await run(VISITORS_SQL)
  const pageviewsByPath = await run(PAGEVIEWS_BY_PATH_SQL)
  const clinicViews = await run(CLINIC_VIEWS_SQL)
  const eventsByType = await run(EVENTS_BY_TYPE_SQL)
  const visitorsByState = await run(VISITORS_BY_STATE_SQL)
  const visitorsByDevice = await run(VISITORS_BY_DEVICE_SQL)
  const pageviewsByReferrer = await run(PAGEVIEWS_BY_REFERRER_SQL)
  const deleteRes = await pool.query(DELETE_OLD_EVENTS_SQL)

  return {
    pageviews,
    visitors,
    pageviewsByPath,
    clinicViews,
    eventsByType,
    visitorsByState,
    visitorsByDevice,
    pageviewsByReferrer,
    deletedOldEvents: deleteRes.rowCount ?? 0,
  }
}
