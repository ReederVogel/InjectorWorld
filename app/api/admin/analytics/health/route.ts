import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdminOrEditor } from '@/lib/auth-guards'
import { serverError } from '@/lib/api-errors'

export const runtime = 'nodejs'

/**
 * GET /api/admin/analytics/health
 * Last-24h event counts by type, plus total row count, so the founder can
 * confirm the beacon -> ingest -> insert pipeline is actually flowing after
 * a deploy. Auth: admin or editor.
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

  try {
    const [byType, total] = await Promise.all([
      pool.query(
        `SELECT event_type, count(*)::int AS count
         FROM analytics.events
         WHERE ts >= now() - interval '24 hours'
         GROUP BY event_type
         ORDER BY count DESC`,
      ),
      pool.query(`SELECT count(*)::int AS count FROM analytics.events`),
    ])

    return NextResponse.json({
      last24h: byType.rows,
      totalRows: total.rows[0]?.count ?? 0,
    })
  } catch (err: any) {
    payload.logger.error(`[analytics/health] ${err?.message ?? err}`)
    return serverError('admin/analytics/health', err, 'Health check failed.')
  }
}
