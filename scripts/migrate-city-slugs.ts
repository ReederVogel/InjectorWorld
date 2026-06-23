/**
 * migrate-city-slugs.ts
 *
 * Updates all Location records where kind = 'city' | 'metro':
 *   old slug: new-york-ny, houston-tx, los-angeles-ca ...
 *   new slug: new-york-city, houston, los-angeles ...
 *
 * The new slug is derived purely from the location name (no state suffix).
 * Idempotent: re-running is safe.
 *
 * Run: npx tsx --env-file=.env.local scripts/migrate-city-slugs.ts
 */

import { getPayloadInstance } from '../lib/payload-server'

function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

async function main() {
  console.log('Connecting to Payload...')
  const payload = await getPayloadInstance()

  // Fetch all city / metro locations
  const locRes = await payload.find({
    collection: 'locations',
    where: { kind: { in: ['city', 'metro'] } },
    limit: 5000,
    depth: 0,
  })

  console.log(`Found ${locRes.docs.length} city/metro Location records`)

  let updated = 0
  let skipped = 0

  for (const loc of locRes.docs as any[]) {
    const newSlug = nameToSlug(loc.name)
    if (loc.slug === newSlug) {
      skipped++
      continue
    }

    console.log(`  [${loc.kind}] "${loc.name}": ${loc.slug} → ${newSlug}`)

    await payload.update({
      collection: 'locations',
      id: loc.id,
      data: { slug: newSlug },
    })
    updated++
  }

  console.log(`\nDone. Updated: ${updated}, Already correct: ${skipped}`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
