import { getPayload } from 'payload'
import config from '../payload.config'

async function main() {
  const payload = await getPayload({ config })
  const res = await payload.find({
    collection: 'data-alerts',
    where: { status: { equals: 'open' } } as any,
    limit: 100,
    depth: 0
  })

  console.log('\n===== OPEN DATA ALERTS =====\n')
  console.log(`Total: ${res.docs.length}\n`)
  for (const doc of res.docs as any[]) {
    console.log(`[${doc.severity.toUpperCase()}] type: ${doc.type}`)
    console.log(`Message: ${doc.message}`)
    console.log(`Doc ID: ${doc.documentId} (Collection: ${doc.collectionSlug})`)
    if (doc.relatedId) {
      console.log(`Related ID: ${doc.relatedId}`)
    }
    console.log('--------------------------------------------')
  }
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
