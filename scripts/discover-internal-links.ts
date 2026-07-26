/**
 * CLI wrapper around the same discovery-agent logic the admin "Scan" button
 * uses (lib/internal-links/discover.ts) -- useful for a one-off bulk catch-up
 * run from the terminal instead of clicking through the admin UI.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/discover-internal-links.ts [--batch=N] [--max-cost=N]
 */
import { getPayload } from 'payload'
import config from '../payload.config'
import { runDiscoveryBatch, loadCandidates } from '../lib/internal-links/discover'

function numArg(name: string, fallback: number): number {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`))
  if (!arg) return fallback
  const n = Number(arg.split('=')[1])
  return Number.isFinite(n) ? n : fallback
}

async function main() {
  const payload = await getPayload({ config })
  const batchSize = numArg('batch', 4)
  const maxCost = numArg('max-cost', 5)

  // Loaded once and reused across batches -- otherwise every batch re-reads
  // ~1400 candidate rows for no benefit.
  console.log('Loading candidates...')
  const candidates = await loadCandidates(payload)
  console.log(`${candidates.length} candidates.\n`)

  let scanned = 0
  let created = 0
  let failed = 0
  let tokens = 0
  let cost = 0

  for (;;) {
    const r = await runDiscoveryBatch(payload, batchSize, candidates)
    scanned += r.scanned
    created += r.created
    failed += r.failed
    tokens += r.promptTokens + r.completionTokens
    cost += r.costUsd

    console.log(
      `scanned ${scanned}/${r.total} · ${created} suggestions · ${failed} failed · ` +
        `${tokens.toLocaleString()} tokens · ~$${cost.toFixed(4)} · ${r.remaining} left`,
    )

    if (r.remaining <= 0) break
    // No forward progress this batch (everything left is erroring) -- stop
    // rather than spinning on the same documents forever.
    if (r.scanned === 0 && r.failed === 0) break
    if (cost >= maxCost) {
      console.log(`\nStopping: cost cap $${maxCost} reached.`)
      break
    }
  }

  console.log(
    `\n===== Done: ${scanned} scanned, ${created} suggestions, ${failed} failed, ` +
      `${tokens.toLocaleString()} tokens, ~$${cost.toFixed(4)} =====`,
  )
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
