/**
 * drip-index.ts — flip the oldest approved+noindex items to indexed + nofollow=false.
 * Usage: npm run drip:index -- news --count=5
 *        npm run drip:index -- guides --count=10
 */

import { getPayload } from 'payload'
import config from '../payload.config'

const args = process.argv.slice(2)
const collection = args[0] as 'news' | 'guides' | undefined
const countArg = args.find((a) => a.startsWith('--count='))
const count = countArg ? parseInt(countArg.replace('--count=', ''), 10) : 5

if (!collection || !['news', 'guides'].includes(collection)) {
  console.error('Usage: npx tsx scripts/drip-index.ts <news|guides> [--count=N]')
  process.exit(1)
}

const safeCollection = collection as 'news' | 'guides'

async function run() {
  const payload = await getPayload({ config })

  const QUEUE = {
    and: [
      { reviewStatus: { equals: 'approved' } },
      { indexState: { equals: 'noindex' } },
    ],
  }

  const queued = await payload.find({
    collection: safeCollection,
    where: QUEUE as any,
    sort: 'approvedAt',
    limit: count,
    depth: 0,
  })

  if (queued.docs.length === 0) {
    console.log(`[drip:index] No approved+noindex ${safeCollection} items in queue.`)
    process.exit(0)
  }

  let indexed = 0
  for (const doc of queued.docs) {
    await payload.update({
      collection: safeCollection,
      id: doc.id,
      data: { indexState: 'indexed' as const, nofollow: false },
      overrideAccess: true,
    })
    indexed++
    console.log(`[drip:index] Indexed: ${(doc as any).slug} (id ${doc.id})`)
  }

  const remaining = await payload.find({
    collection: safeCollection,
    where: QUEUE as any,
    limit: 0,
    depth: 0,
  })

  console.log(`\n[drip:index] Done: ${indexed} indexed. ${remaining.totalDocs} remain in queue.`)
  process.exit(0)
}

run().catch((err) => {
  console.error('[drip:index] Fatal:', err)
  process.exit(1)
})
