/**
 * Mock data seed for injector.world
 *
 * Idempotent: re-running won't create duplicates. It skips collections
 * that already have rows. To wipe and re-seed, drop the database and re-run.
 *
 * All names, license numbers, and locations are fictional. Real lat/lng
 * coordinates are used so PostGIS queries return realistic results.
 *
 * Run with: npm run seed
 */
import { getPayload } from 'payload'
import config from '../payload.config'
import {
  treatments,
  authors,
  medicalReviewers,
  states,
  metros,
  nycNeighborhoods,
  clinics,
  providers,
  reviews,
  beforeAfterCases,
  guides,
  faqs,
  photos,
  promotions,
} from './seed-data'

async function seed() {
  console.log('\n===== injector.world seed =====\n')
  const payload = await getPayload({ config })

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@injector.world'
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'changeme'

  // 1. Admin user
  const existingUsers = await payload.find({ collection: 'users', limit: 1 })
  if (existingUsers.totalDocs === 0) {
    await payload.create({
      collection: 'users',
      data: {
        email: adminEmail,
        password: adminPassword,
        name: 'Site Admin',
        role: 'admin',
      },
    })
    console.log(`Admin created.  email: ${adminEmail}  password: ${adminPassword}`)
    console.log('CHANGE THE PASSWORD after first login in /admin.\n')
  } else {
    console.log('Admin user exists. Skipping.')
  }

  // 2. Treatments
  await seedIfEmpty(payload, 'treatments', treatments, 'name')

  // 3. Locations (states + metros + NYC neighborhoods)
  const existingLocations = await payload.find({ collection: 'locations', limit: 1 })
  if (existingLocations.totalDocs === 0) {
    for (const s of states) await payload.create({ collection: 'locations', data: s as any })
    for (const m of metros) await payload.create({ collection: 'locations', data: m as any })
    for (const n of nycNeighborhoods) await payload.create({ collection: 'locations', data: n as any })
    console.log(`Locations seeded: ${states.length} states + ${metros.length} metros + ${nycNeighborhoods.length} neighborhoods.`)
  } else {
    console.log('Locations exist. Skipping.')
  }

  // 4. Authors
  await seedIfEmpty(payload, 'authors', authors, 'fullName')

  // 5. Medical reviewers
  await seedIfEmpty(payload, 'medical-reviewers', medicalReviewers, 'fullName')

  // 6. Clinics
  const existingClinics = await payload.find({ collection: 'clinics', limit: 1 })
  if (existingClinics.totalDocs === 0) {
    for (const c of clinics) {
      await payload.create({ collection: 'clinics', data: c as any })
    }
    console.log(`Clinics seeded: ${clinics.length}.`)
  } else {
    console.log('Clinics exist. Skipping.')
  }

  // 7. Providers — need to look up clinic + treatment IDs
  const existingProviders = await payload.find({ collection: 'providers', limit: 1 })
  if (existingProviders.totalDocs === 0) {
    const clinicMap = await mapByField(payload, 'clinics', 'clinicId')
    const treatmentMap = await mapByField(payload, 'treatments', 'slug')

    for (const p of providers) {
      const clinicId = clinicMap[p.clinicRefId]
      const treatmentIds = p.treatmentSlugs
        .map((s) => treatmentMap[s])
        .filter(Boolean) as number[]

      if (!clinicId) {
        console.warn(`Missing clinic for provider ${p.fullName}.`)
        continue
      }

      const { clinicRefId, treatmentSlugs, ...rest } = p
      await payload.create({
        collection: 'providers',
        data: {
          ...rest,
          clinic: clinicId,
          treatmentsOffered: treatmentIds,
        } as any,
      })
    }
    console.log(`Providers seeded: ${providers.length}.`)
  } else {
    console.log('Providers exist. Skipping.')
  }

  // 8. Reviews — link to providers + clinics
  const existingReviews = await payload.find({ collection: 'reviews', limit: 1 })
  if (existingReviews.totalDocs === 0) {
    const providerMap = await mapByField(payload, 'providers', 'providerId')
    const clinicMap = await mapByField(payload, 'clinics', 'clinicId')

    for (const r of reviews) {
      const providerId = r.providerRefId ? providerMap[r.providerRefId] : undefined
      const clinicId = clinicMap[r.clinicRefId]
      if (!clinicId) continue
      const { providerRefId, clinicRefId, ...rest } = r
      await payload.create({
        collection: 'reviews',
        data: { ...rest, provider: providerId, clinic: clinicId } as any,
      })
    }
    console.log(`Reviews seeded: ${reviews.length}.`)
  } else {
    console.log('Reviews exist. Skipping.')
  }

  // 9. Before / after cases
  const existingBeforeAfter = await payload.find({ collection: 'before-after-cases', limit: 1 })
  if (existingBeforeAfter.totalDocs === 0) {
    const providerMap = await mapByField(payload, 'providers', 'providerId')
    for (const b of beforeAfterCases) {
      const providerId = b.providerRefId ? providerMap[b.providerRefId] : undefined
      const { providerRefId, ...rest } = b
      await payload.create({
        collection: 'before-after-cases',
        data: { ...rest, provider: providerId } as any,
      })
    }
    console.log(`Before/after cases seeded: ${beforeAfterCases.length}.`)
  } else {
    console.log('Before/after cases exist. Skipping.')
  }

  // 10. Guides — link to authors + medical reviewers + treatments
  const existingGuides = await payload.find({ collection: 'guides', limit: 1 })
  if (existingGuides.totalDocs === 0) {
    const authorMap = await mapByField(payload, 'authors', 'slug')
    const reviewerMap = await mapByField(payload, 'medical-reviewers', 'slug')
    const treatmentMap = await mapByField(payload, 'treatments', 'slug')

    for (const g of guides) {
      const { authorSlug, reviewerSlug, treatmentSlug, ...rest } = g
      await payload.create({
        collection: 'guides',
        data: {
          ...rest,
          author: authorMap[authorSlug],
          medicalReviewer: reviewerSlug ? reviewerMap[reviewerSlug] : undefined,
          relatedTreatment: treatmentSlug ? treatmentMap[treatmentSlug] : undefined,
        } as any,
      })
    }
    console.log(`Guides seeded: ${guides.length}.`)
  } else {
    console.log('Guides exist. Skipping.')
  }

  // 11. FAQs
  await seedIfEmpty(payload, 'faqs', faqs, 'question')

  // 12. Photos
  await seedIfEmpty(payload, 'photos', photos, 'photoId')

  // 13. Promotions — always wipe and re-seed (slug mapping may have changed)
  const existingPromos = await payload.find({ collection: 'promotions', limit: 100 })
  for (const p of existingPromos.docs) {
    await payload.delete({ collection: 'promotions', id: (p as any).id })
  }
  if (true) {
    const providerMap = await mapByField(payload, 'providers', 'slug')
    const treatmentMap = await mapByField(payload, 'treatments', 'slug')
    const locationMap = await mapByField(payload, 'locations', 'slug')

    for (const p of promotions) {
      const providerId = providerMap[p.providerSlug]
      if (!providerId) { console.warn(`Promotion: provider slug "${p.providerSlug}" not found. Skipping.`); continue }

      await payload.create({
        collection: 'promotions',
        data: {
          provider: providerId,
          scopeType: p.scopeType,
          treatmentScope: p.treatmentSlug ? treatmentMap[p.treatmentSlug] : undefined,
          locationScope: p.locationSlug ? locationMap[p.locationSlug] : undefined,
          rank: p.rank,
          active: p.active,
          notes: p.notes,
          startDate: p.startDate,
          endDate: p.endDate,
        } as any,
      })
    }
    console.log(`Promotions seeded: ${promotions.length}.`)
  } else {
    console.log('Promotions exist. Skipping.')
  }

  console.log('\n===== seed complete =====\n')
  process.exit(0)
}

async function seedIfEmpty<T extends Record<string, any>>(
  payload: any,
  collection: string,
  rows: readonly T[],
  labelField: string
) {
  const existing = await payload.find({ collection, limit: 1 })
  if (existing.totalDocs > 0) {
    console.log(`${collection} exists (${existing.totalDocs}+ rows). Skipping.`)
    return
  }
  for (const r of rows) {
    await payload.create({ collection, data: r as any })
  }
  console.log(`${collection} seeded: ${rows.length}.`)
}

async function mapByField(payload: any, collection: string, field: string) {
  const result = await payload.find({ collection, limit: 1000, pagination: false })
  const map: Record<string, any> = {}
  for (const doc of result.docs) {
    map[doc[field]] = doc.id
  }
  return map
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
