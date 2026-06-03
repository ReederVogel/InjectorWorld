/**
 * One-time migration: normalise Location slugs to match the locked URL structure.
 *   States:       state-ny  →  new-york
 *   Metros:       new-york-city-ny  →  new-york-ny   (and other top-20 cities)
 *   Neighborhoods: upper-east-side-nyc  →  upper-east-side
 *
 * Safe to re-run — skips records that already have the correct slug.
 */
import { getPayload } from 'payload'
import config from '@payload-config'

const STATE_SLUG: Record<string, string> = {
  Alabama: 'alabama', Alaska: 'alaska', Arizona: 'arizona', Arkansas: 'arkansas',
  California: 'california', Colorado: 'colorado', Connecticut: 'connecticut',
  Delaware: 'delaware', Florida: 'florida', Georgia: 'georgia', Hawaii: 'hawaii',
  Idaho: 'idaho', Illinois: 'illinois', Indiana: 'indiana', Iowa: 'iowa',
  Kansas: 'kansas', Kentucky: 'kentucky', Louisiana: 'louisiana', Maine: 'maine',
  Maryland: 'maryland', Massachusetts: 'massachusetts', Michigan: 'michigan',
  Minnesota: 'minnesota', Mississippi: 'mississippi', Missouri: 'missouri',
  Montana: 'montana', Nebraska: 'nebraska', Nevada: 'nevada',
  'New Hampshire': 'new-hampshire', 'New Jersey': 'new-jersey', 'New Mexico': 'new-mexico',
  'New York': 'new-york', 'North Carolina': 'north-carolina', 'North Dakota': 'north-dakota',
  Ohio: 'ohio', Oklahoma: 'oklahoma', Oregon: 'oregon', Pennsylvania: 'pennsylvania',
  'Rhode Island': 'rhode-island', 'South Carolina': 'south-carolina',
  'South Dakota': 'south-dakota', Tennessee: 'tennessee', Texas: 'texas', Utah: 'utah',
  Vermont: 'vermont', Virginia: 'virginia', Washington: 'washington',
  'West Virginia': 'west-virginia', Wisconsin: 'wisconsin', Wyoming: 'wyoming',
}

const METRO_SLUG: Record<string, string> = {
  'New York City': 'new-york-ny',
  'Los Angeles': 'los-angeles-ca',
  'Miami': 'miami-fl',
  'Chicago': 'chicago-il',
  'Houston': 'houston-tx',
  'Dallas': 'dallas-tx',
  'Atlanta': 'atlanta-ga',
  'Phoenix': 'phoenix-az',
  'Seattle': 'seattle-wa',
  'Boston': 'boston-ma',
  'Washington DC': 'washington-dc',
  'San Francisco': 'san-francisco-ca',
  'Denver': 'denver-co',
  'Austin': 'austin-tx',
  'San Diego': 'san-diego-ca',
  'Philadelphia': 'philadelphia-pa',
  'Nashville': 'nashville-tn',
  'Charlotte': 'charlotte-nc',
  'Las Vegas': 'las-vegas-nv',
  'Portland': 'portland-or',
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

async function main() {
  const payload = await getPayload({ config })

  const all = await payload.find({ collection: 'locations', limit: 10000, depth: 0 })
  let updated = 0
  let skipped = 0

  for (const loc of all.docs as any[]) {
    let targetSlug: string | null = null

    if (loc.kind === 'state') {
      targetSlug = STATE_SLUG[loc.name] ?? slugify(loc.name)
    } else if (loc.kind === 'metro') {
      targetSlug = METRO_SLUG[loc.name] ?? null
    } else if (loc.kind === 'neighborhood') {
      // strip any trailing city suffix like "-nyc", "-la", "-chi"
      const bare = loc.slug.replace(/-(?:nyc|la|chi|sf|miami|dallas|houston|atl|bos|sea|phx|dc|den|aus|sd|philly|nash|clt|lv|pdx)$/, '')
      targetSlug = bare
    }

    if (!targetSlug || targetSlug === loc.slug) {
      skipped++
      continue
    }

    await payload.update({
      collection: 'locations',
      id: loc.id,
      data: { slug: targetSlug },
    })
    console.log(`  ${loc.kind}: "${loc.name}"  ${loc.slug}  →  ${targetSlug}`)
    updated++
  }

  console.log(`\nSlug fix: Updated ${updated}, Skipped ${skipped}`)

  // Step 2: Link neighborhoods to their parent city (NYC neighborhoods → new-york-ny)
  const nycRes = await payload.find({ collection: 'locations', where: { slug: { equals: 'new-york-ny' } }, limit: 1 })
  const nycId = nycRes.docs[0]?.id
  if (nycId) {
    const hoodsRes = await payload.find({
      collection: 'locations',
      where: { and: [{ kind: { equals: 'neighborhood' } }, { state: { equals: 'NY' } }] },
      limit: 100,
    })
    let linked = 0
    for (const h of hoodsRes.docs as any[]) {
      if (h.parent) continue
      await payload.update({ collection: 'locations', id: h.id, data: { parent: nycId } })
      linked++
    }
    console.log(`Linked ${linked} NYC neighborhoods to new-york-ny.`)
  } else {
    console.log('NYC metro not found — neighborhood parent linking skipped.')
  }

  console.log('\nDone.')
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
