/**
 * Standalone url-registry scan. Refreshes `page_index` for every url the site
 * publishes: listing pages, clinics, guides, news and static routes.
 *
 * Run it against staging:
 *
 *   npx tsx --env-file=.env.staging scripts/scan-pages.ts
 *
 * NOTE the explicit --env-file. Do NOT use `npm run scan:pages` for this: every
 * npm script here is hardcoded to `--env-file=.env.local`, and .env.local points
 * at PRODUCTION.
 *
 * This is the recommended way to run the FIRST full scan on a fresh registry.
 * The admin button runs the same code as a background job, but the first run is
 * the biggest (~92,700 rows) and the CLI gives live output and no timeout to
 * worry about.
 *
 * Logic lives in lib/page-index/scan-pages.ts, shared with the admin
 * "Run page scan" button at /api/admin/scan-pages.
 *
 * Safe to re-run. A scan never changes an indexing decision -- it only records
 * which urls exist and whether each has anything to show. Nothing can go live
 * because of a scan.
 */
import { getPayload } from 'payload'
import config from '../payload.config'
import { scanPages } from '../lib/page-index/scan-pages'

async function main() {
  const host = (() => {
    try { return new URL(process.env.DATABASE_URI ?? '').host } catch { return 'unknown' }
  })()
  console.log(`[scan:pages] Database host: ${host}\n`)

  const payload = await getPayload({ config })
  const started = Date.now()

  let lastLine = ''
  const res = await scanPages(payload, ({ phase, processed, total }) => {
    const line = total ? `${phase}: ${processed?.toLocaleString()} / ${total.toLocaleString()}` : phase
    // Only print when the text actually changes, so a 186-batch run does not
    // produce 186 near-identical lines.
    if (line === lastLine) return
    lastLine = line
    console.log(`  ${line}`)
  })

  const secs = ((Date.now() - started) / 1000).toFixed(1)

  console.log(`\n===== url registry scan =====`)
  console.log(res.baseline ? 'Baseline established (registry was empty).' : 'Incremental scan.')
  console.log(`Took ${secs}s`)
  console.log(`Total urls: ${res.total.toLocaleString()}`)
  console.log(`  Created: ${res.created.toLocaleString()} · Updated: ${res.updated.toLocaleString()} · Lost data: ${res.lostData.toLocaleString()} · Failed: ${res.failed.toLocaleString()}`)
  console.log(`\nBy source:`)
  for (const [k, v] of Object.entries(res.bySource)) {
    console.log(`  ${k.padEnd(12)} ${Number(v).toLocaleString()}`)
  }
  console.log(`\nIndexed now: ${res.indexedNow.toLocaleString()} · Queued now: ${res.queuedNow.toLocaleString()}`)
  console.log(`Markets flipped live: ${res.marketsFlippedLive} · flipped coming-soon: ${res.marketsFlippedComingSoon}`)

  if (res.unmappedClinics > 0) {
    console.log(
      `\nWARNING: ${res.unmappedClinics.toLocaleString()} published clinic(s) have a city/state that matches no ` +
      `Location, so no url could be built for them. They are absent from the registry.`,
    )
  }
  if (res.failed > 0) {
    console.log(
      `\nWARNING: ${res.failed} row(s) failed to write, so the lost-data reconcile was SKIPPED ` +
      `(a failed batch looks identical to a url that vanished). Fix the cause and re-run.`,
    )
  }

  console.log(`\nNothing is indexed by this. Batch urls in from /admin/indexing.\n`)
  process.exit(0)
}

main().catch((err) => { console.error(err); process.exit(1) })
