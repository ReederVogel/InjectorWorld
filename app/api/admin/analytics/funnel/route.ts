import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdminOrEditor } from '@/lib/auth-guards'

export const runtime = 'nodejs'

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// Raw analytics.events is only retained 90 days, so this range never exceeds
// that cap regardless of what's requested.
function parseRange(req: NextRequest): { from: string; to: string; days: number } {
  const requested = Number(req.nextUrl.searchParams.get('days'))
  const days = [7, 30, 90].includes(requested) ? requested : 30
  const today = new Date()
  const from = new Date(today.getTime() - (days - 1) * 24 * 60 * 60 * 1000)
  return { from: isoDate(from), to: isoDate(today), days }
}

/**
 * GET /api/admin/analytics/funnel?days=7|30|90
 * Session-level funnel: sessions -> clinic view -> booking opened ->
 * booking submitted, plus contact reveal. Queries raw analytics.events
 * (capped at 90 days) with one conditional-aggregation SQL statement over
 * session_id. Auth: admin or editor.
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
    const res = await pool.query(
      `WITH sessions AS (
         SELECT session_id,
                bool_or(event_type = 'clinic_view') AS has_clinic_view,
                bool_or(event_type = 'booking_open') AS has_booking_open,
                bool_or(event_type = 'booking_submit') AS has_booking_submit,
                bool_or(event_type = 'contact_reveal') AS has_contact_reveal
         FROM analytics.events
         WHERE session_id IS NOT NULL AND ts >= $1::date AND ts < ($2::date + interval '1 day')
         GROUP BY session_id
       )
       SELECT
         count(*)::bigint AS total,
         count(*) FILTER (WHERE has_clinic_view)::bigint AS clinic_view,
         count(*) FILTER (WHERE has_booking_open)::bigint AS booking_open,
         count(*) FILTER (WHERE has_booking_submit)::bigint AS booking_submit,
         count(*) FILTER (WHERE has_contact_reveal)::bigint AS contact_reveal
       FROM sessions`,
      [from, to],
    )

    const row = res.rows[0] ?? {}
    return NextResponse.json({
      from,
      to,
      days,
      sessions: {
        total: Number(row.total ?? 0),
        clinicView: Number(row.clinic_view ?? 0),
        bookingOpen: Number(row.booking_open ?? 0),
        bookingSubmit: Number(row.booking_submit ?? 0),
        contactReveal: Number(row.contact_reveal ?? 0),
      },
    })
  } catch (err: any) {
    payload.logger.error(`[analytics/funnel] ${err?.message ?? err}`)
    return NextResponse.json({ error: err?.message ?? 'Funnel failed.' }, { status: 500 })
  }
}
