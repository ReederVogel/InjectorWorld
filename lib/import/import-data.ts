import type { Payload } from 'payload'
import {
  type Row,
  str, num, int, bool, isoDate, list, listOfObj, kebab, providerSlug, normalizeCity, treatmentSlugFor,
} from './helpers'

export type AlertInput = {
  alertKey: string
  type:
    | 'duplicate_clinic' | 'duplicate_provider' | 'missing_coordinates' | 'missing_source'
    | 'unknown_treatment' | 'broken_relationship' | 'unmatched_city' | 'missing_trust_field'
    | 'orphaned_promotion' | 'other'
  severity: 'error' | 'warning' | 'info'
  message: string
  collectionSlug?: string
  documentId?: string
  relatedId?: string
}

export type ImportReport = {
  clinics: { created: number; updated: number; skipped: number }
  providers: { created: number; updated: number; skipped: number }
  reviews: { created: number; updated: number; skipped: number }
  alerts: AlertInput[]
}

type Maps = {
  treatmentSlugToId: Record<string, any>
  metroCities: Set<string> // normalized "city|ST"
  clinicIdToDocId: Record<string, any>
  clinicIdToCity: Record<string, string>
  providerIdToDocId: Record<string, any>
}

async function findOne(payload: Payload, collection: any, field: string, value: string) {
  const res = await payload.find({
    collection,
    where: { [field]: { equals: value } } as any,
    limit: 1,
    depth: 0,
  })
  return res.docs[0]
}

export async function runImport(
  payload: Payload,
  data: { clinics?: Row[]; providers?: Row[]; reviews?: Row[] },
  opts: { source?: string } = {},
): Promise<ImportReport> {
  const source = opts.source ?? 'import'
  const alerts: AlertInput[] = []
  const report: ImportReport = {
    clinics: { created: 0, updated: 0, skipped: 0 },
    providers: { created: 0, updated: 0, skipped: 0 },
    reviews: { created: 0, updated: 0, skipped: 0 },
    alerts,
  }

  // Preload lookup maps.
  const treatmentsRes = await payload.find({ collection: 'treatments', limit: 1000, depth: 0 })
  const treatmentSlugToId: Record<string, any> = {}
  for (const t of treatmentsRes.docs as any[]) treatmentSlugToId[t.slug] = t.id

  const metrosRes = await payload.find({
    collection: 'locations',
    where: { kind: { equals: 'metro' } } as any,
    limit: 1000,
    depth: 0,
  })
  const metroCities = new Set<string>()
  for (const m of metrosRes.docs as any[]) {
    if (m.name && m.state) metroCities.add(`${normalizeCity(m.name)}|${m.state}`)
  }

  const maps: Maps = { treatmentSlugToId, metroCities, clinicIdToDocId: {}, clinicIdToCity: {}, providerIdToDocId: {} }

  if (data.clinics) await importClinics(payload, data.clinics, maps, report)
  if (data.providers) await importProviders(payload, data.providers, maps, report)
  if (data.clinics && data.providers) await linkClinicProviders(payload, data.clinics, maps)
  if (data.reviews) await importReviews(payload, data.reviews, maps, report)

  // Persist alerts (upsert by alertKey so re-runs don't duplicate).
  for (const a of alerts) {
    await upsertAlert(payload, a, source)
  }

  // Self-heal: auto-resolve previously-open alerts from this source that are
  // no longer being raised (the underlying issue was fixed).
  await reconcileAlerts(payload, source, new Set(alerts.map((a) => a.alertKey)))

  // Keep Location.providerCount honest (drives the homepage "X providers" labels).
  await recomputeProviderCounts(payload)

  return report
}

/**
 * Recompute Location.providerCount for every state + metro from actual provider
 * records (joined via clinic city/state). Only writes when the count changed, to
 * avoid audit-log noise. Runs at the end of every import.
 */
export async function recomputeProviderCounts(payload: Payload) {
  const provRes = await payload.find({ collection: 'providers', limit: 100000, depth: 1 })
  const byState: Record<string, number> = {}
  const byCity: Record<string, number> = {} // key: normalizedCity|ST
  for (const p of provRes.docs as any[]) {
    const clinic = p.clinic
    if (!clinic || typeof clinic !== 'object') continue
    const st = (clinic.state ?? '').toUpperCase()
    if (st) byState[st] = (byState[st] ?? 0) + 1
    if (clinic.city && st) {
      const key = `${normalizeCity(clinic.city)}|${st}`
      byCity[key] = (byCity[key] ?? 0) + 1
    }
  }

  const locRes = await payload.find({ collection: 'locations', limit: 5000, depth: 0 })
  for (const loc of locRes.docs as any[]) {
    let next: number | undefined
    if (loc.kind === 'state') next = byState[(loc.state ?? '').toUpperCase()] ?? 0
    else if (loc.kind === 'metro' || loc.kind === 'city')
      next = byCity[`${normalizeCity(loc.name)}|${(loc.state ?? '').toUpperCase()}`] ?? 0
    if (next === undefined || next === (loc.providerCount ?? 0)) continue
    try {
      await payload.update({ collection: 'locations', id: loc.id, data: { providerCount: next }, overrideAccess: true })
    } catch {
      /* non-fatal */
    }
  }
}

/** Mark open alerts from `source` whose key is no longer raised as resolved. */
export async function reconcileAlerts(payload: Payload, source: string, currentKeys: Set<string>) {
  const prior = await payload.find({
    collection: 'data-alerts',
    where: { and: [{ source: { equals: source } }, { status: { not_equals: 'resolved' } }] } as any,
    limit: 100000,
    depth: 0,
  })
  for (const d of prior.docs as any[]) {
    if (!currentKeys.has(d.alertKey)) {
      try {
        await payload.update({
          collection: 'data-alerts',
          id: d.id,
          overrideAccess: true,
          data: { status: 'resolved' } as any,
        })
      } catch {
        /* non-fatal */
      }
    }
  }
}

async function importClinics(payload: Payload, rows: Row[], maps: Maps, report: ImportReport) {
  const seenPlaceIds: Record<string, string> = {}

  for (const r of rows) {
    const clinicId = str(r.clinic_id)
    const clinicName = str(r.clinic_name)
    if (!clinicId || !clinicName) {
      report.clinics.skipped++
      report.alerts.push({
        alertKey: `clinic-missing-id-${clinicName ?? Math.random()}`,
        type: 'broken_relationship', severity: 'error',
        message: `Clinic row missing clinic_id or clinic_name (name: ${clinicName ?? 'unknown'})`,
        collectionSlug: 'clinics',
      })
      continue
    }

    const lat = num(r.latitude)
    const lng = num(r.longitude)
    if (lat === undefined || lng === undefined) {
      report.clinics.skipped++
      report.alerts.push({
        alertKey: `clinic-coords-${clinicId}`,
        type: 'missing_coordinates', severity: 'error',
        message: `Clinic ${clinicName} (${clinicId}) is missing latitude/longitude and was not imported.`,
        collectionSlug: 'clinics', documentId: clinicId,
      })
      continue
    }

    const placeId = str(r.google_place_id)
    if (placeId) {
      if (seenPlaceIds[placeId]) {
        report.alerts.push({
          alertKey: `dup-clinic-place-${placeId}`,
          type: 'duplicate_clinic', severity: 'warning',
          message: `Clinics ${seenPlaceIds[placeId]} and ${clinicId} share google_place_id ${placeId} (possible duplicate).`,
          collectionSlug: 'clinics', documentId: clinicId, relatedId: seenPlaceIds[placeId],
        })
      } else {
        seenPlaceIds[placeId] = clinicId
        // Also check DB for an existing different clinic with this place id.
        const existingByPlace = await findOne(payload, 'clinics', 'googlePlaceId', placeId)
        if (existingByPlace && (existingByPlace as any).clinicId !== clinicId) {
          report.alerts.push({
            alertKey: `dup-clinic-place-db-${placeId}`,
            type: 'duplicate_clinic', severity: 'warning',
            message: `Clinic ${clinicId} has the same google_place_id as existing clinic ${(existingByPlace as any).clinicId}.`,
            collectionSlug: 'clinics', documentId: clinicId, relatedId: String((existingByPlace as any).clinicId),
          })
        }
      }
    }

    if (list(r.source_urls).length === 0) {
      report.alerts.push({
        alertKey: `clinic-nosource-${clinicId}`,
        type: 'missing_source', severity: 'warning',
        message: `Clinic ${clinicName} (${clinicId}) has no source_urls (audit trail missing).`,
        collectionSlug: 'clinics', documentId: clinicId,
      })
    }

    // City must match a known metro Location or it won't appear on city pages.
    const city = str(r.city)
    const state = str(r.state)
    if (city) maps.clinicIdToCity[clinicId] = city
    if (city && state && !maps.metroCities.has(`${normalizeCity(city)}|${state}`)) {
      report.alerts.push({
        alertKey: `clinic-city-${clinicId}`,
        type: 'unmatched_city', severity: 'info',
        message: `Clinic ${clinicName} is in ${city}, ${state} which has no metro Location record; it will not appear on a city directory page.`,
        collectionSlug: 'clinics', documentId: clinicId,
      })
    }

    const dataObj: Record<string, unknown> = {
      clinicId,
      clinicName,
      slug: kebab(clinicName),
      tagline: str(r.tagline),
      description: str(r.description),
      addressLine1: str(r.address_line_1),
      addressLine2: str(r.address_line_2),
      city, state, zip: str(r.zip),
      neighborhood: str(r.neighborhood),
      county: str(r.county),
      country: str(r.country) ?? 'US',
      latitude: lat, longitude: lng,
      googlePlaceId: placeId,
      googleMapsUrl: str(r.google_maps_url),
      directionsUrl: str(r.directions_url),
      appleMapsUrl: str(r.apple_maps_url),
      phone: str(r.phone),
      email: str(r.email),
      websiteUrl: str(r.website_url),
      bookingUrl: str(r.booking_url),
      hoursJson: str(r.hours_json) ? safeJson(r.hours_json) : undefined,
      serviceType: str(r.service_type) ?? 'In-Person',
      acceptsInsurance: bool(r.accepts_insurance),
      paymentMethods: str(r.payment_methods),
      amenities: str(r.amenities),
      logoUrl: str(r.logo_url),
      clinicPhotoUrls: listOfObj(r.clinic_photo_urls, 'url'),
      aggregateRating: num(r.aggregate_rating),
      aggregateRatingCount: int(r.aggregate_rating_count),
      yearEstablished: int(r.year_established),
      sourceUrls: listOfObj(r.source_urls, 'url'),
      lastScrapedDate: isoDate(r.last_scraped_date),
    }

    const existing = await findOne(payload, 'clinics', 'clinicId', clinicId)
    try {
      if (existing) {
        await payload.update({ collection: 'clinics', id: (existing as any).id, data: clean(dataObj) as any })
        maps.clinicIdToDocId[clinicId] = (existing as any).id
        report.clinics.updated++
      } else {
        const created = await payload.create({ collection: 'clinics', data: clean(dataObj) as any })
        maps.clinicIdToDocId[clinicId] = created.id
        report.clinics.created++
      }
    } catch (err: any) {
      report.clinics.skipped++
      report.alerts.push({
        alertKey: `clinic-fail-${clinicId}`,
        type: 'other', severity: 'error',
        message: `Failed to import clinic ${clinicId}: ${err.message}`,
        collectionSlug: 'clinics', documentId: clinicId,
      })
    }
  }
}

async function importProviders(payload: Payload, rows: Row[], maps: Maps, report: ImportReport) {
  const seenLicense: Record<string, string> = {} // fullName|state|number -> providerId

  for (const r of rows) {
    const providerId = str(r.provider_id)
    const fullName = str(r.full_name)
    const credentials = str(r.credentials)
    if (!providerId || !fullName || !credentials) {
      report.providers.skipped++
      continue
    }

    // Dedupe by full_name + license_state + license_number.
    const licNum = str(r.license_number)
    const licState = str(r.license_state)
    const dedupeKey = `${fullName.toLowerCase()}|${licState}|${licNum}`
    if (seenLicense[dedupeKey] && seenLicense[dedupeKey] !== providerId) {
      report.providers.skipped++
      report.alerts.push({
        alertKey: `dup-provider-${dedupeKey}`,
        type: 'duplicate_provider', severity: 'warning',
        message: `Provider ${providerId} duplicates ${seenLicense[dedupeKey]} (same name + state + license ${licNum}). Skipped.`,
        collectionSlug: 'providers', documentId: providerId, relatedId: seenLicense[dedupeKey],
      })
      continue
    }
    seenLicense[dedupeKey] = providerId

    // Resolve clinic (from this run's map, or fall back to the DB).
    const clinicId = str(r.clinic_id)
    let clinicDocId = clinicId ? maps.clinicIdToDocId[clinicId] : undefined
    if (!clinicDocId && clinicId) {
      const existingClinic = await findOne(payload, 'clinics', 'clinicId', clinicId)
      if (existingClinic) {
        clinicDocId = (existingClinic as any).id
        maps.clinicIdToDocId[clinicId] = clinicDocId
        if ((existingClinic as any).city) maps.clinicIdToCity[clinicId] = (existingClinic as any).city
      }
    }
    if (!clinicDocId) {
      report.providers.skipped++
      report.alerts.push({
        alertKey: `provider-clinic-${providerId}`,
        type: 'broken_relationship', severity: 'error',
        message: `Provider ${fullName} (${providerId}) references clinic_id ${clinicId ?? 'none'} which does not exist. Skipped.`,
        collectionSlug: 'providers', documentId: providerId, relatedId: clinicId,
      })
      continue
    }

    // Resolve treatments.
    const treatmentIds: any[] = []
    for (const label of list(r.treatments_offered)) {
      const slug = treatmentSlugFor(label)
      const id = slug ? maps.treatmentSlugToId[slug] : undefined
      if (id) {
        if (!treatmentIds.includes(id)) treatmentIds.push(id)
      } else {
        report.alerts.push({
          alertKey: `unknown-treatment-${providerId}-${kebab(label)}`,
          type: 'unknown_treatment', severity: 'warning',
          message: `Provider ${fullName} (${providerId}) lists treatment "${label}" which is not in the master treatment list. Skipped that treatment.`,
          collectionSlug: 'providers', documentId: providerId,
        })
      }
    }
    if (treatmentIds.length === 0) {
      report.providers.skipped++
      report.alerts.push({
        alertKey: `provider-notreatments-${providerId}`,
        type: 'broken_relationship', severity: 'error',
        message: `Provider ${fullName} (${providerId}) has no recognized treatments; cannot import (treatmentsOffered is required).`,
        collectionSlug: 'providers', documentId: providerId,
      })
      continue
    }

    if (list(r.source_urls).length === 0) {
      report.alerts.push({
        alertKey: `provider-nosource-${providerId}`,
        type: 'missing_source', severity: 'warning',
        message: `Provider ${fullName} (${providerId}) has no source_urls (audit trail missing).`,
        collectionSlug: 'providers', documentId: providerId,
      })
    }
    if (!str(r.profile_photo_url)) {
      report.alerts.push({
        alertKey: `provider-nophoto-${providerId}`,
        type: 'missing_trust_field', severity: 'info',
        message: `Provider ${fullName} (${providerId}) has no profile photo. Add one before featuring them.`,
        collectionSlug: 'providers', documentId: providerId,
      })
    }

    const dataObj: Record<string, unknown> = {
      providerId,
      fullName,
      slug: providerSlug(fullName, credentials, str(r.city) ?? (clinicId ? maps.clinicIdToCity[clinicId] : undefined)),
      credentials,
      title: str(r.title),
      boardCertifications: listOfObj(r.board_certifications, 'name'),
      licenseNumber: licNum,
      licenseState: licState,
      licenseStatus: str(r.license_status) ?? 'Active',
      licenseVerificationUrl: str(r.license_verification_url),
      npiNumber: str(r.npi_number),
      yearsExperience: int(r.years_experience),
      yearStartedPracticing: int(r.year_started_practicing),
      clinic: clinicDocId,
      tagline: str(r.tagline),
      bio: str(r.bio),
      profilePhotoUrl: str(r.profile_photo_url),
      languages: list(r.languages),
      gender: str(r.gender),
      treatmentsOffered: treatmentIds,
      specialties: listOfObj(r.specialties, 'name'),
      pricingBotoxPerUnit: num(r.pricing_botox_per_unit),
      pricingFillerPerSyringe: num(r.pricing_filler_per_syringe),
      pricingConsultation: num(r.pricing_consultation),
      acceptsNewPatients: bool(r.accepts_new_patients, true),
      offersVirtualConsult: bool(r.offers_virtual_consult, false),
      offersInPerson: bool(r.offers_in_person, true),
      websiteUrl: str(r.website_url),
      email: str(r.email),
      phoneDirect: str(r.phone_direct),
      instagramUrl: str(r.instagram_url),
      tiktokUrl: str(r.tiktok_url),
      linkedinUrl: str(r.linkedin_url),
      aggregateRating: num(r.aggregate_rating),
      aggregateRatingCount: int(r.aggregate_rating_count),
      sourceUrls: listOfObj(r.source_urls, 'url'),
      lastScrapedDate: isoDate(r.last_scraped_date),
    }

    const existing = await findOne(payload, 'providers', 'providerId', providerId)
    try {
      if (existing) {
        await payload.update({ collection: 'providers', id: (existing as any).id, data: clean(dataObj) as any })
        maps.providerIdToDocId[providerId] = (existing as any).id
        report.providers.updated++
      } else {
        const created = await payload.create({ collection: 'providers', data: clean(dataObj) as any })
        maps.providerIdToDocId[providerId] = created.id
        report.providers.created++
      }
    } catch (err: any) {
      report.providers.skipped++
      report.alerts.push({
        alertKey: `provider-fail-${providerId}`,
        type: 'other', severity: 'error',
        message: `Failed to import provider ${providerId}: ${err.message}`,
        collectionSlug: 'providers', documentId: providerId,
      })
    }
  }
}

/** After providers exist, set each clinic.providers relationship from provider_ids. */
async function linkClinicProviders(payload: Payload, clinicRows: Row[], maps: Maps) {
  for (const r of clinicRows) {
    const clinicId = str(r.clinic_id)
    const clinicDocId = clinicId ? maps.clinicIdToDocId[clinicId] : undefined
    if (!clinicDocId) continue
    const providerDocIds = list(r.provider_ids)
      .map((pid) => maps.providerIdToDocId[pid])
      .filter(Boolean)
    if (providerDocIds.length === 0) continue
    try {
      await payload.update({ collection: 'clinics', id: clinicDocId, data: { providers: providerDocIds } as any })
    } catch {
      /* non-fatal */
    }
  }
}

async function importReviews(payload: Payload, rows: Row[], maps: Maps, report: ImportReport) {
  for (const r of rows) {
    const reviewId = str(r.review_id)
    const clinicId = str(r.clinic_id)
    if (!reviewId) { report.reviews.skipped++; continue }

    const clinicDocId = clinicId ? maps.clinicIdToDocId[clinicId] : undefined
    if (!clinicDocId) {
      // Try DB (clinic may have been imported in a previous run).
      const existingClinic = clinicId ? await findOne(payload, 'clinics', 'clinicId', clinicId) : undefined
      if (!existingClinic) {
        report.reviews.skipped++
        report.alerts.push({
          alertKey: `review-clinic-${reviewId}`,
          type: 'broken_relationship', severity: 'error',
          message: `Review ${reviewId} references clinic_id ${clinicId ?? 'none'} which does not exist. Skipped.`,
          collectionSlug: 'reviews', documentId: reviewId, relatedId: clinicId,
        })
        continue
      }
      maps.clinicIdToDocId[clinicId!] = (existingClinic as any).id
    }

    // Optional provider link.
    let providerDocId: any
    const providerId = str(r.provider_id)
    if (providerId) {
      providerDocId = maps.providerIdToDocId[providerId]
      if (!providerDocId) {
        const existingProvider = await findOne(payload, 'providers', 'providerId', providerId)
        if (existingProvider) {
          providerDocId = (existingProvider as any).id
          maps.providerIdToDocId[providerId] = providerDocId
        } else {
          report.alerts.push({
            alertKey: `review-provider-${reviewId}`,
            type: 'broken_relationship', severity: 'warning',
            message: `Review ${reviewId} names provider_id ${providerId} which does not exist. Attached to clinic only.`,
            collectionSlug: 'reviews', documentId: reviewId, relatedId: providerId,
          })
        }
      }
    }

    const dataObj: Record<string, unknown> = {
      reviewId,
      provider: providerDocId,
      clinic: maps.clinicIdToDocId[clinicId!],
      reviewerFirstName: str(r.reviewer_first_name),
      reviewerInitial: str(r.reviewer_initial),
      reviewerAgeRange: str(r.reviewer_age_range),
      reviewerCity: str(r.reviewer_city),
      rating: int(r.rating),
      reviewTitle: str(r.review_title),
      reviewText: str(r.review_text),
      treatmentTag: str(r.treatment_tag),
      reviewDate: isoDate(r.review_date),
      sourcePlatform: str(r.source_platform),
      sourceUrl: str(r.source_url),
      responseFromProvider: str(r.response_from_provider),
      responseDate: isoDate(r.response_date),
      verified: true,
    }

    const existing = await findOne(payload, 'reviews', 'reviewId', reviewId)
    try {
      if (existing) {
        await payload.update({ collection: 'reviews', id: (existing as any).id, data: clean(dataObj) as any })
        report.reviews.updated++
      } else {
        await payload.create({ collection: 'reviews', data: clean(dataObj) as any })
        report.reviews.created++
      }
    } catch (err: any) {
      report.reviews.skipped++
      report.alerts.push({
        alertKey: `review-fail-${reviewId}`,
        type: 'other', severity: 'error',
        message: `Failed to import review ${reviewId}: ${err.message}`,
        collectionSlug: 'reviews', documentId: reviewId,
      })
    }
  }
}

export async function upsertAlert(payload: Payload, a: AlertInput, source: string) {
  const existing = await findOne(payload, 'data-alerts', 'alertKey', a.alertKey)
  const data = {
    ...a,
    source,
    status: 'open',
  }
  try {
    if (existing) {
      // Refresh message/severity but keep an acknowledged/resolved status sticky.
      const keepStatus = (existing as any).status
      await payload.update({
        collection: 'data-alerts',
        id: (existing as any).id,
        overrideAccess: true,
        data: { ...data, status: keepStatus === 'resolved' ? 'resolved' : keepStatus } as any,
      })
    } else {
      await payload.create({ collection: 'data-alerts', overrideAccess: true, data: data as any })
    }
  } catch (err) {
    payload.logger.error(`[alerts] failed to upsert alert ${a.alertKey}: ${err}`)
  }
}

// --- small utils ---

function clean<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v
  }
  return out as Partial<T>
}

function safeJson(v: string | undefined) {
  if (!v) return undefined
  try { return JSON.parse(v) } catch { return undefined }
}
