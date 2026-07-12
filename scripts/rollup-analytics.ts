/**
 * CLI wrapper for the analytics daily rollup. Aggregates analytics.events
 * into analytics.daily. Idempotent -- re-running the same range is safe.
 *
 *   npx tsx --env-file=.env.local scripts/rollup-analytics.ts
 *   npx tsx --env-file=.env.local scripts/rollup-analytics.ts 2026-07-01 2026-07-10
 *
 * Defaults to the last 2 days through today. Run on a schedule (DO cron)
 * so analytics.daily stays current -- scheduling it is a founder task.
 */
import { getPayload } from 'payload'
import config from '../payload.config'
import { runRollup } from '../lib/analytics/rollup'

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

async function main() {
  const [, , fromArg, toArg] = process.argv
  const today = new Date()
  const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000)

  const from = fromArg || isoDate(twoDaysAgo)
  const to = toArg || isoDate(today)

  const payload = await getPayload({ config })
  const result = await runRollup(payload, { from, to })

  console.log(`\n===== analytics rollup: ${from} -> ${to} =====`)
  console.log(result)
  console.log('')
  process.exit(0)
}

main().catch((err) => { console.error(err); process.exit(1) })
