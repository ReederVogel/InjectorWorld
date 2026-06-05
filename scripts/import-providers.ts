/**
 * CSV bulk import for clinics, providers, and reviews.
 *
 * Reads CSVs that match data/scraper-brief.md schemas, upserts by business id
 * (clinicId / providerId / reviewId), validates relationships, and writes any
 * problems to the DataAlerts collection (visible in /admin).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/import-providers.ts                      # uses data/samples/*.sample.csv
 *   npx tsx --env-file=.env.local scripts/import-providers.ts --dir ./data/real    # uses clinics.csv / providers.csv / reviews.csv in that dir
 *
 * Safe to re-run: existing records are updated, not duplicated.
 */
import { getPayload } from 'payload'
import fs from 'fs'
import path from 'path'
import config from '../payload.config'
import { parseCsv } from '../lib/import/csv'
import { runImport } from '../lib/import/import-data'

function readIfExists(p: string): string | null {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null
}

async function main() {
  const args = process.argv.slice(2)
  const dirFlag = args.indexOf('--dir')
  const useSamples = dirFlag === -1
  const dir = useSamples ? path.resolve('data/samples') : path.resolve(args[dirFlag + 1])
  const suffix = useSamples ? '.sample.csv' : '.csv'

  console.log(`\n===== injector.world data import =====`)
  console.log(`Source dir: ${dir}  (${useSamples ? 'SAMPLE' : 'REAL'} data)\n`)

  const clinicsText = readIfExists(path.join(dir, `clinics${suffix}`))
  const providersText = readIfExists(path.join(dir, `providers${suffix}`))
  const reviewsText = readIfExists(path.join(dir, `reviews${suffix}`))

  if (!clinicsText && !providersText && !reviewsText) {
    console.error(`No CSVs found in ${dir}. Expected clinics${suffix} / providers${suffix} / reviews${suffix}.`)
    process.exit(1)
  }

  const payload = await getPayload({ config })

  const report = await runImport(
    payload,
    {
      clinics: clinicsText ? parseCsv(clinicsText) : undefined,
      providers: providersText ? parseCsv(providersText) : undefined,
      reviews: reviewsText ? parseCsv(reviewsText) : undefined,
    },
    { source: 'import' },
  )

  console.log('Clinics  ', report.clinics)
  console.log('Providers', report.providers)
  console.log('Reviews  ', report.reviews)
  console.log(`\nAlerts raised: ${report.alerts.length}`)
  const bySeverity = report.alerts.reduce<Record<string, number>>((acc, a) => {
    acc[a.severity] = (acc[a.severity] ?? 0) + 1
    return acc
  }, {})
  console.log('  by severity:', bySeverity)
  for (const a of report.alerts) {
    console.log(`  [${a.severity}] ${a.type}: ${a.message}`)
  }
  console.log(`\nAlerts are saved to the DataAlerts collection (/admin → System → Data Alerts).`)
  console.log(`===== import complete =====\n`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
