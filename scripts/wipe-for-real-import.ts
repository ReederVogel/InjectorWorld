/**
 * One-shot wipe of all fake/seed content before real data import.
 * Deletes: clinics, providers, reviews, photos, before-after-cases, qa,
 *          bookings, claims, promotions, data-alerts, news, guides
 * Keeps: users, treatments, locations, zip-codes, brands, authors,
 *        medical-reviewers, media, audit-logs
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/wipe-for-real-import.ts
 */

import { getPayload } from 'payload'
import config from '../payload.config'

const ORDER = [
  'reviews', 'photos', 'before-after-cases', 'qa',
  'bookings', 'claims', 'promotions', 'data-alerts',
  'providers', 'clinics',
  'news', 'guides',
] as const

async function main() {
  const payload = await getPayload({ config })

  console.log('\n===== WIPE fake content before real import =====\n')

  for (const slug of ORDER) {
    try {
      const res = await payload.find({ collection: slug as any, limit: 1, depth: 0 })
      const total = res.totalDocs
      if (total === 0) { console.log(`  ${slug.padEnd(20)} 0  (already empty)`); continue }

      await payload.delete({
        collection: slug as any,
        where: { id: { exists: true } },
        overrideAccess: true,
      })
      console.log(`  ${slug.padEnd(20)} deleted ${total} rows`)
    } catch (err: any) {
      console.error(`  ${slug}: ERROR — ${err?.message ?? err}`)
    }
  }

  console.log('\n===== done =====\n')
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
