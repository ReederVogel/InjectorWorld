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

async function topByMetric(
  pool: any,
  metric: string,
  from: string,
  to: string,
  limit: number,
): Promise<{ dimension: string; total: number }[]> {
  const res = await pool.query(
    `SELECT dimension, sum(value)::bigint AS total
     FROM analytics.daily
     WHERE metric = $1 AND day >= $2::date AND day <= $3::date AND dimension != ''
     GROUP BY dimension
     ORDER BY total DESC
     LIMIT $4`,
    [metric, from, to, limit],
  )
  return (res.rows as { dimension: string; total: string }[]).map((r) => ({
    dimension: r.dimension,
    total: Number(r.total),
  }))
}

/**
 * GET /api/admin/analytics/top?days=7|30|90
 * Top paths, top clinics (with resolved names + per-clinic lead counts for
 * the same range), visitor breakdowns by state/device, and top referrer
 * hosts -- all summed from analytics.daily. Auth: admin or editor.
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
    const [pathsRows, clinicsRows, stateRows, deviceRows, referrerRows] = await Promise.all([
      topByMetric(pool, 'pageviews_by_path', from, to, 20),
      topByMetric(pool, 'clinic_views', from, to, 20),
      topByMetric(pool, 'visitors_by_state', from, to, 60),
      topByMetric(pool, 'visitors_by_device', from, to, 10),
      topByMetric(pool, 'pageviews_by_referrer', from, to, 20),
    ])

    const clinicIds = clinicsRows
      .map((r) => Number(r.dimension))
      .filter((n) => Number.isFinite(n))

    const [clinicsRes, leadsRes] = await Promise.all([
      clinicIds.length
        ? payload.find({
            collection: 'clinics',
            where: { id: { in: clinicIds } },
            depth: 0,
            limit: clinicIds.length,
            overrideAccess: true,
          })
        : Promise.resolve({ docs: [] as any[] }),
      clinicIds.length
        ? payload.find({
            collection: 'bookings',
            where: {
              and: [
                { clinic: { in: clinicIds } },
                { createdAt: { greater_than_equal: `${from}T00:00:00.000Z` } },
                { createdAt: { less_than: `${to}T23:59:59.999Z` } },
              ],
            },
            depth: 0,
            limit: 5000,
            overrideAccess: true,
          })
        : Promise.resolve({ docs: [] as any[] }),
    ])

    const clinicMap = new Map<number, { name: string; city: string | null; state: string | null }>()
    for (const doc of clinicsRes.docs as any[]) {
      clinicMap.set(Number(doc.id), {
        name: doc.clinicName || `Clinic #${doc.id}`,
        city: doc.city ?? null,
        state: doc.state ?? null,
      })
    }

    const leadsByClinic = new Map<number, number>()
    for (const doc of leadsRes.docs as any[]) {
      const cid = typeof doc.clinic === 'number' ? doc.clinic : Number(doc.clinic)
      if (Number.isFinite(cid)) leadsByClinic.set(cid, (leadsByClinic.get(cid) ?? 0) + 1)
    }

    const topClinics = clinicsRows.map((row) => {
      const id = Number(row.dimension)
      const clinic = clinicMap.get(id)
      return {
        id,
        name: clinic?.name ?? `Clinic #${id}`,
        city: clinic?.city ?? null,
        state: clinic?.state ?? null,
        views: row.total,
        leads: leadsByClinic.get(id) ?? 0,
      }
    })

    return NextResponse.json({
      from,
      to,
      days,
      topPaths: pathsRows.map((r) => ({ path: r.dimension, views: r.total })),
      topClinics,
      visitorsByState: stateRows.map((r) => ({ state: r.dimension, visitors: r.total })),
      visitorsByDevice: deviceRows.map((r) => ({ device: r.dimension, visitors: r.total })),
      topReferrers: referrerRows.map((r) => ({ host: r.dimension, views: r.total })),
    })
  } catch (err: any) {
    payload.logger.error(`[analytics/top] ${err?.message ?? err}`)
    return NextResponse.json({ error: err?.message ?? 'Top failed.' }, { status: 500 })
  }
}
