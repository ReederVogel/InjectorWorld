import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdminOrEditor } from '@/lib/auth-guards'
import { getMonthlySpendUsd } from '@/lib/assistant/usage'

export const runtime = 'nodejs'

/**
 * GET /api/admin/assistant-usage
 * Summary numbers for the dashboard's "Assistant usage" panel: this month's
 * spend (reuses the same figure the live budget cap checks), a daily spend
 * series, and the priciest / flagged exchanges. Read-only reporting against
 * the existing assistant_logs table -- no new fields, no writes.
 */
export async function GET(req: NextRequest) {
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdminOrEditor(user)
  if (guard) return guard

  const pool = (payload.db as any).pool

  let monthlySpendUsd = 0
  try {
    monthlySpendUsd = await getMonthlySpendUsd(pool)
  } catch (err) {
    payload.logger.error(`[assistant-usage] monthly spend query failed: ${err}`)
  }

  let dailySpend: Array<{ day: string; costUsd: number }> = []
  try {
    const startOfMonth = new Date()
    startOfMonth.setUTCDate(1)
    startOfMonth.setUTCHours(0, 0, 0, 0)
    const res = await pool.query(
      `SELECT date_trunc('day', created_at) AS day, SUM(estimated_cost_usd) AS cost
       FROM assistant_logs WHERE created_at >= $1 GROUP BY day ORDER BY day`,
      [startOfMonth.toISOString()],
    )
    dailySpend = res.rows.map((r: any) => ({ day: r.day, costUsd: Number(r.cost ?? 0) }))
  } catch (err) {
    payload.logger.error(`[assistant-usage] daily spend query failed: ${err}`)
  }

  let topQueries: Array<{ query: string; costUsd: number; tokensIn: number; tokensOut: number; createdAt: string }> = []
  try {
    const res = await pool.query(
      `SELECT query, estimated_cost_usd, tokens_in, tokens_out, created_at
       FROM assistant_logs ORDER BY estimated_cost_usd DESC LIMIT 10`,
    )
    topQueries = res.rows.map((r: any) => ({
      query: r.query,
      costUsd: Number(r.estimated_cost_usd ?? 0),
      tokensIn: Number(r.tokens_in ?? 0),
      tokensOut: Number(r.tokens_out ?? 0),
      createdAt: r.created_at,
    }))
  } catch (err) {
    payload.logger.error(`[assistant-usage] top queries query failed: ${err}`)
  }

  let flagged: Array<{ query: string; costUsd: number; createdAt: string }> = []
  try {
    const res = await pool.query(
      `SELECT query, estimated_cost_usd, created_at
       FROM assistant_logs WHERE flagged = true ORDER BY created_at DESC LIMIT 10`,
    )
    flagged = res.rows.map((r: any) => ({
      query: r.query,
      costUsd: Number(r.estimated_cost_usd ?? 0),
      createdAt: r.created_at,
    }))
  } catch (err) {
    payload.logger.error(`[assistant-usage] flagged query failed: ${err}`)
  }

  return NextResponse.json({ monthlySpendUsd, dailySpend, topQueries, flagged })
}
