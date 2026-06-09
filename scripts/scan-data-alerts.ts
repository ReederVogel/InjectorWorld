/**
 * Standalone data-integrity scan. Re-checks the whole database and upserts
 * DataAlerts. Run on a schedule (DO cron / Payload jobs) or manually:
 *
 *   npx tsx --env-file=.env.local scripts/scan-data-alerts.ts
 *
 * The detection logic lives in lib/import/scan.ts (shared with the admin
 * "Re-scan" button at /api/admin/scan).
 */
import { getPayload } from 'payload'
import config from '../payload.config'
import { runScan } from '../lib/import/scan'

async function main() {
  const payload = await getPayload({ config })
  const res = await runScan(payload)

  console.log(`\n===== data-alerts scan =====`)
  console.log(`Scanned ${res.scanned.clinics} clinics, ${res.scanned.providers} providers, ${res.scanned.promotions} promotions.`)
  console.log(`Alerts upserted: ${res.alerts.length}`)
  console.log('  by severity:', res.bySeverity)
  console.log(`See /admin → System → Data Alerts.\n`)
  process.exit(0)
}

main().catch((err) => { console.error(err); process.exit(1) })
