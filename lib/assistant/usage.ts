/**
 * Cost tracking and abuse limits for the AI assistant.
 *
 * Every exchange is logged to the `assistant-logs` Payload collection
 * (visible in admin), which also powers two hard caps that run BEFORE
 * calling Anthropic, so a capped request never reaches the paid API:
 *   1. A monthly org-wide spend ceiling (ASSISTANT_MONTHLY_BUDGET_USD).
 *   2. A per-IP daily message limit (ASSISTANT_IP_DAILY_LIMIT).
 */
import { ASSISTANT_MONTHLY_BUDGET_USD, ASSISTANT_IP_DAILY_LIMIT } from './config'

// Sonnet 5 standard rate (not the temporary intro discount) -- deliberately
// the higher number so the budget check never under-counts real spend.
const COST_PER_INPUT_TOKEN = 3 / 1_000_000
const COST_PER_OUTPUT_TOKEN = 15 / 1_000_000

export function estimateCostUsd(tokensIn: number, tokensOut: number): number {
  return tokensIn * COST_PER_INPUT_TOKEN + tokensOut * COST_PER_OUTPUT_TOKEN
}

export async function getMonthlySpendUsd(pool: any): Promise<number> {
  const startOfMonth = new Date()
  startOfMonth.setUTCDate(1)
  startOfMonth.setUTCHours(0, 0, 0, 0)
  try {
    const res = await pool.query(
      `SELECT COALESCE(SUM(estimated_cost_usd), 0) AS total FROM assistant_logs WHERE created_at >= $1`,
      [startOfMonth.toISOString()],
    )
    return Number(res.rows[0]?.total ?? 0)
  } catch {
    // A broken/missing log table must not silently disable spend protection --
    // fail CLOSED (treat as over-budget) rather than open.
    return Infinity
  }
}

export async function isOverMonthlyBudget(pool: any): Promise<boolean> {
  const spent = await getMonthlySpendUsd(pool)
  return spent >= ASSISTANT_MONTHLY_BUDGET_USD
}

export async function getIpMessageCountToday(pool: any, ip: string): Promise<number> {
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)
  try {
    const res = await pool.query(
      `SELECT COUNT(*)::int AS n FROM assistant_logs WHERE ip = $1 AND created_at >= $2`,
      [ip, startOfDay.toISOString()],
    )
    return Number(res.rows[0]?.n ?? 0)
  } catch {
    return 0
  }
}

export async function isOverIpDailyLimit(pool: any, ip: string): Promise<boolean> {
  if (ip === 'unknown') return false // never lock out everyone behind a shared/missing-IP proxy
  const count = await getIpMessageCountToday(pool, ip)
  return count >= ASSISTANT_IP_DAILY_LIMIT
}

export async function logAssistantExchange(
  payload: any,
  entry: { query: string; ip: string; tokensIn: number; tokensOut: number; toolsUsed: string[]; flagged?: boolean },
): Promise<void> {
  try {
    await payload.create({
      collection: 'assistant-logs',
      overrideAccess: true,
      data: {
        query: entry.query.slice(0, 500),
        ip: entry.ip,
        tokensIn: entry.tokensIn,
        tokensOut: entry.tokensOut,
        estimatedCostUsd: estimateCostUsd(entry.tokensIn, entry.tokensOut),
        toolsUsed: entry.toolsUsed.join(', '),
        flagged: !!entry.flagged,
      },
    })
  } catch {
    // Logging must never break the chat itself.
  }
}
