import { getPayload } from 'payload'
import config from '../payload.config'

async function main() {
  const payload = await getPayload({ config })
  const toCreate: [string, string][] = [
    ['Body', 'body'],
    ['Hair', 'hair'],
    ['Wellness', 'wellness'],
  ]
  for (const [name, slug] of toCreate) {
    const existing = await payload.find({ collection: 'services', where: { slug: { equals: slug } }, limit: 1 })
    if (existing.docs.length > 0) {
      console.log('Already exists:', name, (existing.docs[0] as any).id)
      continue
    }
    const created = await payload.create({
      collection: 'services',
      overrideAccess: true,
      data: { name, slug, category: 'other' } as any,
    })
    console.log('Created', name, (created as any).id)
  }
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
