/**
 * Seed demo brands by confirming the branch suggestions the detector already
 * found (clinics that share a brand prefix + phone or website across distinct
 * locations). This is the SAME code path as the admin "Link as brand" button, so
 * it doubles as an end-to-end test of the branch-confirm flow.
 *
 *   npx tsx --env-file=.env.local scripts/seed-brands.ts
 *
 * Idempotent: getBranchSuggestions excludes groups already linked under a brand,
 * so re-running finds nothing to do.
 */
import { getPayload } from 'payload'
import config from '../payload.config'
import { getBranchSuggestions, linkClinicsToBrand } from '../lib/branches'

async function main() {
  const payload = await getPayload({ config })
  const suggestions = await getBranchSuggestions(payload)

  if (suggestions.length === 0) {
    console.log('No pending branch suggestions. Nothing to seed (brands may already be linked).')
    process.exit(0)
  }

  console.log(`Found ${suggestions.length} branch suggestion(s) to link.\n`)

  for (const s of suggestions) {
    const name = s.suggestedBrandName
    const site = s.clinics.find((c) => c.websiteUrl)?.websiteUrl
    const cities = s.clinics.map((c) => `${c.city}, ${c.state}`).join(' · ')
    const description = `${name} is a multi-location aesthetic group with verified injectors across ${s.clinics.length} branches.`

    const result = await linkClinicsToBrand(payload, {
      clinicIds: s.clinics.map((c) => c.id),
      brandName: name,
      alertKeys: s.alertKeys,
      websiteUrl: site,
      description,
    })
    console.log(`  Linked "${result.brandName}" (/brands/${result.brandSlug}) — ${result.linked} locations: ${cities}`)
  }

  console.log('\nDone. Visit /brands to see the hubs.')
  process.exit(0)
}

main().catch((err) => { console.error(err); process.exit(1) })
