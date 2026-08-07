import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdmin } from '@/lib/auth-guards'
import { checkOrigin } from '@/lib/rate-limit'
import { runRollup } from '@/lib/analytics/rollup'
import { serverError } from '@/lib/api-errors'

export const runtime = 'nodejs'

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * POST /api/admin/analytics/rollup
 * Aggregates analytics.events into analytics.daily for a date range.
 * Body: { from?: 'YYYY-MM-DD', to?: 'YYYY-MM-DD' }. Defaults to the last 2
 * days through today. Idempotent -- safe to re-run over the same range.
 * Auth: admin only (system-level aggregation job).
 */
export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdmin(user)
  if (guard) return guard

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    /* empty body is fine -- defaults apply */
  }

  const today = new Date()
  const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000)
  const from = typeof body?.from === 'string' && body.from ? body.from : isoDate(twoDaysAgo)
  const to = typeof body?.to === 'string' && body.to ? body.to : isoDate(today)

  try {
    const result = await runRollup(payload, { from, to })
    return NextResponse.json({ from, to, ...result })
  } catch (err: any) {
    payload.logger.error(`[analytics/rollup] ${err?.message ?? err}`)
    return serverError('admin/analytics/rollup', err, 'Rollup failed.')
  }
}
