import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdminOrEditor } from '@/lib/auth-guards'
import { serverError } from '@/lib/api-errors'

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
 * GET /api/admin/analytics/clinic/[id]?days=7|30|90
 * Per-day clinic_views (today's bucket replaced by a live count, same
 * pattern as /summary), booking_open/booking_submit/contact_reveal totals
 * for this entity from raw analytics.events, and a lead count from the
 * bookings collection for the same range. Used by both the clinic edit
 * sidebar panel and the top-clinics drill-down. Auth: admin or editor.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdminOrEditor(user)
  if (guard) return guard

  const { id: idParam } = await params
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid clinic id.' }, { status: 400 })
  }

  const pool = (payload.db as any).pool
  if (!pool) {
    return NextResponse.json({ error: 'No Postgres pool available.' }, { status: 500 })
  }

  const { from, to, days } = parseRange(req)

  try {
    const [dailyRes, todayLiveRes, engagementRes, leadsRes] = await Promise.all([
      pool.query(
        `SELECT day, value FROM analytics.daily
         WHERE metric = 'clinic_views' AND dimension = $1
           AND day >= $2::date AND day < $3::date
         ORDER BY day`,
        [String(id), from, to],
      ),
      pool.query(
        `SELECT count(*)::bigint AS total
         FROM analytics.events
         WHERE event_type = 'clinic_view' AND entity_type = 'clinic' AND entity_id = $1
           AND ts >= $2::date AND ts < ($2::date + interval '1 day')`,
        [id, to],
      ),
      pool.query(
        `SELECT event_type, count(*)::bigint AS count
         FROM analytics.events
         WHERE entity_type = 'clinic' AND entity_id = $1
           AND event_type IN ('booking_open','booking_submit','contact_reveal','share')
           AND ts >= $2::date AND ts < ($3::date + interval '1 day')
         GROUP BY event_type`,
        [id, from, to],
      ),
      payload.find({
        collection: 'bookings',
        where: {
          and: [
            { clinic: { equals: id } },
            { createdAt: { greater_than_equal: `${from}T00:00:00.000Z` } },
            { createdAt: { less_than: `${to}T23:59:59.999Z` } },
          ],
        },
        depth: 0,
        limit: 0,
        overrideAccess: true,
      }),
    ])

    const byDay = new Map<string, number>()
    for (const row of dailyRes.rows as { day: Date | string; value: string }[]) {
      const key = typeof row.day === 'string' ? row.day.slice(0, 10) : isoDate(new Date(row.day))
      byDay.set(key, Number(row.value))
    }
    const todayLiveViews = Number(todayLiveRes.rows[0]?.total ?? 0)

    const series: { day: string; views: number }[] = []
    let viewsTotal = 0
    const fromDate = new Date(`${from}T00:00:00Z`)
    for (let i = 0; i < days; i++) {
      const d = new Date(fromDate.getTime() + i * 24 * 60 * 60 * 1000)
      const key = isoDate(d)
      const value = key === to ? todayLiveViews : (byDay.get(key) ?? 0)
      series.push({ day: key, views: value })
      viewsTotal += value
    }

    const engagement = { bookingOpen: 0, bookingSubmit: 0, contactReveal: 0, share: 0 }
    for (const row of engagementRes.rows as { event_type: string; count: string }[]) {
      if (row.event_type === 'booking_open') engagement.bookingOpen = Number(row.count)
      if (row.event_type === 'booking_submit') engagement.bookingSubmit = Number(row.count)
      if (row.event_type === 'contact_reveal') engagement.contactReveal = Number(row.count)
      if (row.event_type === 'share') engagement.share = Number(row.count)
    }

    return NextResponse.json({
      from,
      to,
      days,
      clinicId: id,
      series,
      viewsTotal,
      leads: leadsRes.totalDocs ?? 0,
      ...engagement,
    })
  } catch (err: any) {
    payload.logger.error(`[analytics/clinic] ${err?.message ?? err}`)
    return serverError('admin/analytics/clinic/[id]', err, 'Clinic analytics failed.')
  }
}
