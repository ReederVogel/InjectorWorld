import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdminOrEditor } from '@/lib/auth-guards'

export const runtime = 'nodejs'

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function parseRange(req: NextRequest): { from: string; to: string; days: number } {
  const requested = Number(req.nextUrl.searchParams.get('days'))
  const days = [7, 30, 90].includes(requested) ? requested : 30
  const today = new Date()
  const from = new Date(today.getTime() - (days - 1) * 24 * 60 * 60 * 1000)
  return { from: isoDate(from), to: isoDate(today), days }
}

/**
 * GET /api/admin/analytics/summary?days=7|30|90
 * Per-day pageviews/visitors from analytics.daily for the range (today's
 * bucket is always replaced by a live count from analytics.events, since
 * today is not rolled up yet -- or only partially, if the cron already ran).
 * Also returns range totals (clinic views, leads) and events_by_type totals,
 * both merging historical daily rollups with today's live events so a
 * same-day lead or clinic view isn't missing from the KPI row.
 * Auth: admin or editor.
 */
export async function GET(req: NextRequest) {
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdminOrEditor(user)
  if (guard) return guard

  const pool = (payload.db as any).pool
  if (!pool) {
    return NextResponse.json({ error: 'No Postgres pool available.' }, { status: 500 })
  }

  const { from, to, days } = parseRange(req)

  try {
    const [dailyRes, todayLiveRes, eventsByTypeRes, todayEventsRes, clinicViewsRes, todayClinicViewsRes] =
      await Promise.all([
        // Historical rows only, up to but excluding today -- today's own row
        // (if it exists at all) is stale the moment new events land.
        pool.query(
          `SELECT day, metric, value FROM analytics.daily
           WHERE metric IN ('pageviews','visitors') AND dimension = ''
             AND day >= $1::date AND day < $2::date
           ORDER BY day`,
          [from, to],
        ),
        pool.query(
          `SELECT
             count(*) FILTER (WHERE event_type = 'pageview')::bigint AS pageviews,
             count(DISTINCT visitor_id) FILTER (WHERE visitor_id IS NOT NULL)::bigint AS visitors
           FROM analytics.events
           WHERE ts >= $1::date AND ts < ($1::date + interval '1 day')`,
          [to],
        ),
        pool.query(
          `SELECT dimension AS type, sum(value)::bigint AS count
           FROM analytics.daily
           WHERE metric = 'events_by_type' AND day >= $1::date AND day < $2::date
           GROUP BY dimension`,
          [from, to],
        ),
        pool.query(
          `SELECT event_type AS type, count(*)::bigint AS count
           FROM analytics.events
           WHERE ts >= $1::date AND ts < ($1::date + interval '1 day')
           GROUP BY event_type`,
          [to],
        ),
        pool.query(
          `SELECT coalesce(sum(value), 0)::bigint AS total
           FROM analytics.daily
           WHERE metric = 'clinic_views' AND day >= $1::date AND day < $2::date`,
          [from, to],
        ),
        pool.query(
          `SELECT count(*)::bigint AS total
           FROM analytics.events
           WHERE event_type = 'clinic_view' AND ts >= $1::date AND ts < ($1::date + interval '1 day')`,
          [to],
        ),
      ])

    const byDay = new Map<string, { pageviews: number; visitors: number }>()
    for (const row of dailyRes.rows as { day: Date | string; metric: string; value: string }[]) {
      const key = typeof row.day === 'string' ? row.day.slice(0, 10) : isoDate(new Date(row.day))
      const entry = byDay.get(key) ?? { pageviews: 0, visitors: 0 }
      if (row.metric === 'pageviews') entry.pageviews = Number(row.value)
      if (row.metric === 'visitors') entry.visitors = Number(row.value)
      byDay.set(key, entry)
    }

    const todayLive = {
      pageviews: Number(todayLiveRes.rows[0]?.pageviews ?? 0),
      visitors: Number(todayLiveRes.rows[0]?.visitors ?? 0),
    }

    const series: { day: string; pageviews: number; visitors: number }[] = []
    let totalPageviews = 0
    let totalVisitors = 0
    const fromDate = new Date(`${from}T00:00:00Z`)
    for (let i = 0; i < days; i++) {
      const d = new Date(fromDate.getTime() + i * 24 * 60 * 60 * 1000)
      const key = isoDate(d)
      const point = key === to ? todayLive : (byDay.get(key) ?? { pageviews: 0, visitors: 0 })
      series.push({ day: key, pageviews: point.pageviews, visitors: point.visitors })
      totalPageviews += point.pageviews
      totalVisitors += point.visitors
    }

    const eventsByTypeMap = new Map<string, number>()
    for (const row of eventsByTypeRes.rows as { type: string; count: string }[]) {
      eventsByTypeMap.set(row.type, Number(row.count))
    }
    for (const row of todayEventsRes.rows as { type: string; count: string }[]) {
      eventsByTypeMap.set(row.type, (eventsByTypeMap.get(row.type) ?? 0) + Number(row.count))
    }
    const eventsByType = Array.from(eventsByTypeMap.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)

    const totalClinicViews =
      Number(clinicViewsRes.rows[0]?.total ?? 0) + Number(todayClinicViewsRes.rows[0]?.total ?? 0)
    const totalLeads = eventsByTypeMap.get('booking_submit') ?? 0

    return NextResponse.json({
      from,
      to,
      days,
      series,
      totals: {
        pageviews: totalPageviews,
        visitors: totalVisitors,
        clinicViews: totalClinicViews,
        leads: totalLeads,
      },
      todaySoFar: todayLive,
      eventsByType,
    })
  } catch (err: any) {
    payload.logger.error(`[analytics/summary] ${err?.message ?? err}`)
    return NextResponse.json({ error: err?.message ?? 'Summary failed.' }, { status: 500 })
  }
}
