/**
 * CLI wrapper around the same discovery-agent logic the admin "Scan" button
 * uses (lib/internal-links/discover.ts) -- useful for a one-off bulk catch-up
 * run from the terminal instead of clicking through the admin UI.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/discover-internal-links.ts [--limit=N]
 */
import { getPayload } from 'payload'
import config from '../payload.config'
import { runDiscoveryBatch } from '../lib/internal-links/discover'

async function main() {
  const payload = await getPayload({ config })
  const limitArg = process.argv.find((a) => a.startsWith('--limit='))
  const batchSize = limitArg ? parseInt(limitArg.split('=')[1], 10) : 8

  let totalScanned = 0
  let totalCreated = 0

  for (;;) {
    const result = await runDiscoveryBatch(payload, batchSize)
    totalScanned += result.scanned
    totalCreated += result.created
    console.log(`Batch: scanned ${result.scanned}, created ${result.created}, remaining ${result.remaining}`)
    if (result.scanned === 0 || result.remaining <= 0) break
  }

  console.log(`\n===== Done: ${totalScanned} pages scanned, ${totalCreated} suggestions created =====`)
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
