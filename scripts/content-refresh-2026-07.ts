/**
 * One-off: full delete + re-import of Guides and News on STAGING, per the
 * 2026-07-26 editorial handoff (iw-GUIDES-STAGING-COMPLETE-v1.2 + iw-news-rishav-handoff-v1.0).
 *
 * Deletes every existing Guides/News row via Payload's local API (not raw SQL,
 * so relationship join-tables and afterDelete hooks are cleaned up correctly),
 * then imports the 100 guides (single combined batch file) and 125 news
 * articles (per-slug files, merged in-memory into one batch here since this
 * handoff's news package -- unlike guides -- has no combined file).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/content-refresh-2026-07.ts
 */

import fs from 'fs'
import path from 'path'
import { getPayload } from 'payload'
import config from '../payload.config'
import { runContentImport, type ContentImportPayload } from '../lib/import/content-import'

const GUIDES_BATCH_FILE = 'C:\\Users\\risha\\AppData\\Local\\Temp\\iw-guides-check\\_ALL-100-guides-batch-upload.json'
const NEWS_JSON_DIR = 'C:\\Users\\risha\\AppData\\Local\\Temp\\iw-news-check\\json'

async function main() {
  const payload = await getPayload({ config })

  console.log('\n===== Deleting existing Guides =====')
  const deletedGuides = await payload.delete({
    collection: 'guides',
    where: { id: { greater_than: 0 } },
    overrideAccess: true,
  })
  console.log(`  Deleted: ${deletedGuides.docs.length}, errors: ${deletedGuides.errors.length}`)
  if (deletedGuides.errors.length) console.log(deletedGuides.errors.slice(0, 5))

  console.log('\n===== Deleting existing News =====')
  const deletedNews = await payload.delete({
    collection: 'news',
    where: { id: { greater_than: 0 } },
    overrideAccess: true,
  })
  console.log(`  Deleted: ${deletedNews.docs.length}, errors: ${deletedNews.errors.length}`)
  if (deletedNews.errors.length) console.log(deletedNews.errors.slice(0, 5))

  console.log('\n===== Importing 100 Guides =====')
  const guidesParsed: ContentImportPayload = JSON.parse(fs.readFileSync(GUIDES_BATCH_FILE, 'utf8'))
  const guidesReport = await runContentImport(payload, guidesParsed, { batch: 'guides-refresh-2026-07-26', dryRun: false })
  console.log(`  Created: ${guidesReport.items.created}  Updated: ${guidesReport.items.updated}  Skipped: ${guidesReport.items.skipped}`)
  if (guidesReport.alerts.length) {
    console.log(`  Alerts: ${guidesReport.alerts.length}`)
    for (const a of guidesReport.alerts.slice(0, 30)) console.log(`    [${a.severity}] ${a.message}`)
  }

  console.log('\n===== Importing 125 News (merging per-slug files) =====')
  const newsFiles = fs.readdirSync(NEWS_JSON_DIR).filter((f) => f.endsWith('.json'))
  const newsItems: any[] = []
  for (const file of newsFiles) {
    const raw = JSON.parse(fs.readFileSync(path.join(NEWS_JSON_DIR, file), 'utf8'))
    if (raw?.item) newsItems.push(raw.item)
  }
  console.log(`  Merged ${newsItems.length} news items from ${newsFiles.length} files.`)
  const newsParsed: ContentImportPayload = {
    templateVersion: 'injector-world-news-prepared-v1',
    site: 'injector.world',
    contentKind: 'news',
    items: newsItems,
  }
  const newsReport = await runContentImport(payload, newsParsed, { batch: 'news-refresh-2026-07-26', dryRun: false })
  console.log(`  Created: ${newsReport.items.created}  Updated: ${newsReport.items.updated}  Skipped: ${newsReport.items.skipped}`)
  if (newsReport.alerts.length) {
    console.log(`  Alerts: ${newsReport.alerts.length}`)
    for (const a of newsReport.alerts.slice(0, 30)) console.log(`    [${a.severity}] ${a.message}`)
  }

  console.log('\n===== Done =====')
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
