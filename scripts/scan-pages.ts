/**
 * Standalone page-index scan. Walks clinic data and refreshes the `page-index`
 * collection (which pages have data -> staged noindex by default). Run manually:
 *
 *   npx tsx --env-file=.env.local scripts/scan-pages.ts
 *
 * Logic lives in lib/page-index/scan-pages.ts (shared with the admin
 * "Run page scan" button at /api/admin/scan-pages).
 */
import { getPayload } from 'payload'
import config from '../payload.config'
import { scanPages } from '../lib/page-index/scan-pages'

async function main() {
  const payload = await getPayload({ config })
  const res = await scanPages(payload)

  console.log(`\n===== page-index scan =====`)
  console.log(res.baseline ? `Baseline established.` : `Incremental scan.`)
  console.log(`Total data-backed pages: ${res.total}`)
  console.log(`Created: ${res.created} · Updated: ${res.updated} · Lost data: ${res.lostData}`)
  if (res.newPages.length > 0) {
    console.log(`New pages with data (staged noindex):`)
    for (const p of res.newPages) console.log(`  ${p.path} (${p.dataCount} clinics)`)
  }
  console.log(`See /admin → Site Settings → Page Index.\n`)
  process.exit(0)
}

main().catch((err) => { console.error(err); process.exit(1) })
