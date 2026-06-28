/**
 * Seeds the `services` (body-area treatments) and `brands` (product brands)
 * collections. Idempotent: uses upsert-by-slug so re-running is safe.
 *
 * Local:     npx tsx --env-file=.env.local scripts/seed-services-brands.ts
 * DO prod:   DATABASE_URI="<do-uri>" DB_SSL_NO_VERIFY=true npx tsx scripts/seed-services-brands.ts
 */
import { getPayload } from 'payload'
import config from '../payload.config'
import { services, productBrands } from './seed-data'

async function main() {
  console.log('\n===== Seed services + brands =====\n')
  const payload = await getPayload({ config })

  let sCreated = 0, sSkipped = 0
  for (const s of services) {
    const existing = await payload.find({
      collection: 'services',
      where: { slug: { equals: s.slug } },
      limit: 1,
      depth: 0,
    })
    if (existing.docs.length > 0) {
      sSkipped++
    } else {
      await payload.create({ collection: 'services', data: s as any, overrideAccess: true })
      sCreated++
      console.log(`  + service: ${s.name} (${s.slug})`)
    }
  }
  console.log(`services: ${sCreated} created, ${sSkipped} skipped.\n`)

  let bCreated = 0, bSkipped = 0
  for (const b of productBrands) {
    const existing = await payload.find({
      collection: 'brands',
      where: { slug: { equals: b.slug } },
      limit: 1,
      depth: 0,
    })
    if (existing.docs.length > 0) {
      bSkipped++
    } else {
      await payload.create({ collection: 'brands', data: b as any, overrideAccess: true })
      bCreated++
      console.log(`  + brand: ${b.name} (${b.slug})`)
    }
  }
  console.log(`brands: ${bCreated} created, ${bSkipped} skipped.\n`)

  console.log('Done.')
  process.exit(0)
}

main().catch((err) => { console.error(err); process.exit(1) })
