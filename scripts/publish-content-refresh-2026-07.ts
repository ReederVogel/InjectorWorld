/**
 * Bulk-approve the 100 guides + 125 news imported by content-refresh-2026-07.ts.
 * Sets reviewStatus: 'approved', status: 'published' (the actual public gate --
 * see lib/guide-queries.ts / lib/news-queries.ts APPROVED comments).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/publish-content-refresh-2026-07.ts
 */
import { getPayload } from 'payload'
import config from '../payload.config'
import { approveContentUpload } from '../lib/import/content-bulk-upload'

async function main() {
  const payload = await getPayload({ config })

  const guidesResult = await approveContentUpload(payload, 'guides', { batch: 'guides-refresh-2026-07-26' })
  console.log('Guides approved:', guidesResult.approved)

  const newsResult = await approveContentUpload(payload, 'news', { batch: 'news-refresh-2026-07-26' })
  console.log('News approved:', newsResult.approved)

  process.exit(0)
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1) })
