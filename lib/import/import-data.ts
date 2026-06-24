import type { Payload } from 'payload'
import {
  type Row,
  str, num, int, bool, isoDate, list, listOfObj, commaOrSemiList, commaOrSemiListOfObj, titleCase,
  kebab, providerSlug, normalizeCity, treatmentSlugFor,
  isValidZip, isValidLat, isValidLng, normalizePhone,
} from './helpers'
import { LAUNCH_STATE_CODES } from '../markets'

export type AlertInput = {
  alertKey: string
  type:
    | 'duplicate_clinic' | 'duplicate_provider' | 'missing_coordinates' | 'missing_source'
    | 'unknown_treatment' | 'broken_relationship' | 'unmatched_city' | 'missing_trust_field'
    | 'invalid_zip' | 'invalid_coordinates' | 'invalid_phone' | 'duplicate_npi' | 'possible_branch'
    | 'orphaned_promotion' | 'promo_missing_provider' | 'promo_missing_image'
    | 'promo_expired' | 'promo_scope_mismatch' | 'promo_expiring_soon' | 'promo_slot_exceeded'
    | 'content_missing_reviewer' | 'content_missing_author' | 'content_few_sources'
    | 'content_missing_cover' | 'content_validation_error' | 'content_duplicate_slug'
    | 'zip_feature_request'
    | 'other'
  severity: 'error' | 'warning' | 'info'
  message: string
  collectionSlug?: string
  documentId?: string
  relatedId?: string
}

type Counts = { created: number; updated: number; skipped: number }

type ClinicCounts = Counts & {
  publishedCount: number
  reviewCount: number
  draftCount: number
  treatmentsAutoCreated: string[]
}

export type ImportReport = {
  clinics: ClinicCounts
  providers: Counts
  reviews: Counts
  photos: Counts
  qa: Counts
  alerts: AlertInput[]
  dryRun: boolean
  batch?: string
}

/** Per-run options. dryRun = validate + count but never write. */
type Ctx = { dryRun: boolean; batch?: string; maxReviewsPerClinic?: number }

type Maps = {
  treatmentSlugToId: Record<string, any>
  metroCities: Set<string> // normalized "city|ST"
  stateLocByCode: Record<string, any> // "ST" -> state Location doc (for auto-created metros' parent)
  clinicIdToDocId: Record<string, any>
  clinicIdToCity: Record<string, string>
  providerIdToDocId: Record<string, any>
  zipToCity: Record<string, string> // 5-digit ZIP -> city name (from seeded GeoNames data)
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
  data: { clinics?: Row[]; providers?: Row[]; reviews?: Row[]; photos?: Row[]; qa?: Row[] },
  opts: { source?: string; dryRun?: boolean; batch?: string; maxReviewsPerClinic?: number } = {},
): Promise<ImportReport> {
  const source = opts.source ?? 'import'
  const ctx: Ctx = { dryRun: opts.dryRun === true, batch: opts.batch, maxReviewsPerClinic: opts.maxReviewsPerClinic }
  const alerts: AlertInput[] = []
  const report: ImportReport = {
    clinics: { created: 0, updated: 0, skipped: 0, publishedCount: 0, reviewCount: 0, draftCount: 0, treatmentsAutoCreated: [] },
    providers: { created: 0, updated: 0, skipped: 0 },
    reviews: { created: 0, updated: 0, skipped: 0 },
    photos: { created: 0, updated: 0, skipped: 0 },
    qa: { created: 0, updated: 0, skipped: 0 },
    alerts,
    dryRun: ctx.dryRun,
    batch: ctx.batch,
  }

  // Preload lookup maps.
  const treatmentsRes = await payload.find({ collection: 'treatments', limit: 1000, depth: 0 })
  const treatmentSlugToId: Record<string, any> = {}
  for (const t of treatmentsRes.docs as any[]) treatmentSlugToId[t.slug] = t.id

  const metrosRes = await payload.find({
    collection: 'locations',
    where: { kind: { equals: 'metro' } } as any,
    limit: 5000,
    depth: 0,
  })
  const metroCities = new Set<string>()
  for (const m of metrosRes.docs as any[]) {
    if (m.name && m.state) metroCities.add(`${normalizeCity(m.name)}|${m.state}`)
  }

  const statesRes = await payload.find({
    collection: 'locations',
    where: { kind: { equals: 'state' } } as any,
    limit: 1000,
    depth: 0,
  })
  const stateLocByCode: Record<string, any> = {}
  for (const s of statesRes.docs as any[]) if (s.state) stateLocByCode[String(s.state).toUpperCase()] = s

  // Preload ZIP → city from seeded GeoNames data (used to fix scraped city = "CA NNNNN" pattern).
  const zipToCity: Record<string, string> = {}
  try {
    const zipRes = await payload.find({ collection: 'zip-codes', limit: 50000, depth: 0 })
    for (const z of zipRes.docs as any[]) if (z.zip && z.city) zipToCity[z.zip] = z.city
  } catch { /* zip-codes collection may not exist yet */ }

  const maps: Maps = {
    treatmentSlugToId, metroCities, stateLocByCode,
    clinicIdToDocId: {}, clinicIdToCity: {}, providerIdToDocId: {},
    zipToCity,
  }

  if (data.clinics) await importClinics(payload, data.clinics, maps, report, ctx)
  if (data.providers) await importProviders(payload, data.providers, maps, report, ctx)
  if (data.clinics && data.providers) await linkClinicProviders(payload, data.clinics, maps, ctx)
  if (data.reviews) await importReviews(payload, data.reviews, maps, report, ctx)
  if (data.photos) await importPhotos(payload, data.photos, maps, report, ctx)
  if (data.qa) await importQA(payload, data.qa, maps, report, ctx)

  // Dry-run is preview-only: never touch the DB (no alerts persisted, no counts recomputed).
  if (ctx.dryRun) return report

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

function resolveStatus(
  clinicName: string | undefined,
  city: string | undefined,
  state: string | undefined,
  phone: string | undefined,
  websiteUrl: string | undefined,
  latitude: number | undefined,
  longitude: number | undefined,
  needsManualReview: boolean,
  csvPublishStatus: string | undefined,
): 'published' | 'review' | 'draft' {
  if (needsManualReview) return 'review'
  const csv = (csvPublishStatus ?? '').toLowerCase().trim()
  if (csv === 'published') return 'published'
  if (csv === 'draft') return 'draft'
  if (csv === 'review') return 'review'
  const hasCritical = clinicName && city && state && (phone || websiteUrl) && latitude !== undefined && longitude !== undefined
  return hasCritical ? 'published' : 'review'
}

async function resolveOrCreateTreatment(
  payload: Payload,
  rawValue: string,
  maps: Maps,
  treatmentsAutoCreated: string[],
  ctx: Ctx,
): Promise<number | undefined> {
  const trimmed = rawValue.trim()
  if (!trimmed) return undefined

  const aliasSlug = treatmentSlugFor(trimmed)
  const lookupSlug = aliasSlug || kebab(trimmed)
  if (!lookupSlug) return undefined

  if (maps.treatmentSlugToId[lookupSlug] !== undefined) return maps.treatmentSlugToId[lookupSlug]

  const found = await findOne(payload, 'treatments', 'slug', lookupSlug)
  if (found) {
    maps.treatmentSlugToId[lookupSlug] = (found as any).id
    return (found as any).id
  }

  if (ctx.dryRun) return undefined

  const name = titleCase(trimmed)
  try {
    const created = await payload.create({
      collection: 'treatments',
      overrideAccess: true,
      data: { name, slug: lookupSlug, category: 'other' } as any,
    })
    const newId = (created as any).id
    maps.treatmentSlugToId[lookupSlug] = newId
    if (!treatmentsAutoCreated.includes(name)) treatmentsAutoCreated.push(name)
    return newId
  } catch {
    return undefined
  }
}

function normalizeClinicType(raw: string | undefined): string {
  const s = (raw ?? '').toLowerCase().replace(/[^a-z ]/g, '').trim()
  if (!s) return 'other'
  if (s.includes('plastic') || s.includes('cosmetic surgery') || s.includes('facial plastic')) return 'plastic-surgery'
  if (s.includes('derm')) return 'dermatology'
  if (s.includes('dental') || s.includes('dds') || s.includes('orthodon')) return 'dental-aesthetics'
  if (s.includes('med spa') || s.includes('medspa') || s.includes('medical spa') ||
      s.includes('spa') || s.includes('wellness') || s.includes('aesthetic') ||
      s.includes('beauty') || s.includes('rejuven') || s.includes('skin') ||
      s.includes('laser') || s.includes('weight loss') || s.includes('infusion')) return 'medspa'
  return 'other'
}

async function importClinics(payload: Payload, rows: Row[], maps: Maps, report: ImportReport, ctx: Ctx) {
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

    // Out-of-range / swapped coordinates would mis-map. Flag but still import.
    if (!isValidLat(lat) || !isValidLng(lng)) {
      report.alerts.push({
        alertKey: `clinic-badcoords-${clinicId}`,
        type: 'invalid_coordinates', severity: 'warning',
        message: `Clinic ${clinicName} (${clinicId}) has out-of-range coordinates (${lat}, ${lng}); fix before it will map correctly.`,
        collectionSlug: 'clinics', documentId: clinicId,
      })
    }

    // Malformed ZIP (present but not 5-digit / ZIP+4). Flag but still import.
    if (str(r.zip) && !isValidZip(r.zip)) {
      report.alerts.push({
        alertKey: `clinic-zip-${clinicId}`,
        type: 'invalid_zip', severity: 'warning',
        message: `Clinic ${clinicName} (${clinicId}) has an invalid ZIP "${str(r.zip)}".`,
        collectionSlug: 'clinics', documentId: clinicId,
      })
    }

    // Phone normalization (E.164 for clean US numbers; flag dirty ones).
    const phoneN = normalizePhone(r.phone)
    if (str(r.phone) && !phoneN.valid) {
      report.alerts.push({
        alertKey: `clinic-phone-${clinicId}`,
        type: 'invalid_phone', severity: 'info',
        message: `Clinic ${clinicName} (${clinicId}) has a non-standard phone "${str(r.phone)}"; stored as-is.`,
        collectionSlug: 'clinics', documentId: clinicId,
      })
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

    // City must match a metro Location to appear on a city page. If it doesn't,
    // auto-create a Location (live for launch states, coming-soon otherwise) and
    // still flag it so an admin can review. (Phase 4 decision: auto-create + flag.)
    //
    // Scraper sometimes stores "CA 93010" (state+zip) instead of actual city name.
    // Detect that pattern and resolve via our seeded ZIP → city table.
    const rawCity = str(r.city)
    const zip5 = (str(r.zip) ?? '').replace(/[^0-9]/g, '').slice(0, 5)
    const city = (() => {
      if (!rawCity) return undefined
      if (/^[A-Z]{2}\s+\d{5}$/.test(rawCity)) {
        return maps.zipToCity[zip5] ?? undefined
      }
      return rawCity
    })()
    const state = str(r.state)
    if (city) maps.clinicIdToCity[clinicId] = city
    if (city && state) {
      const code = state.toUpperCase()
      const key = `${normalizeCity(city)}|${code}`
      if (!maps.metroCities.has(key)) {
        const live = (LAUNCH_STATE_CODES as readonly string[]).includes(code)
        await autoCreateMetro(payload, city, code, maps, live, ctx)
        maps.metroCities.add(key)
        report.alerts.push({
          alertKey: `clinic-city-${clinicId}`,
          type: 'unmatched_city', severity: 'info',
          message: live
            ? `Clinic ${clinicName} is in ${city}, ${code} which had no metro Location; one was auto-created and set live (launch state).`
            : `Clinic ${clinicName} is in ${city}, ${code} which had no metro Location; a coming-soon Location was auto-created. Review and set it live when ready.`,
          collectionSlug: 'clinics', documentId: clinicId,
        })
      }
    }

    // Phase 1 fields — parse before building dataObj
    const needsManualReview = bool(r.needs_manual_review)

    const treatmentIds: any[] = []
    for (const raw of commaOrSemiList(r.treatment_ids)) {
      const id = await resolveOrCreateTreatment(payload, raw, maps, report.clinics.treatmentsAutoCreated, ctx)
      if (id !== undefined && !treatmentIds.includes(id)) treatmentIds.push(id)
    }

    const resolvedStatus = resolveStatus(
      clinicName,
      city,
      state,
      phoneN.value,
      str(r.website_url),
      lat,
      lng,
      needsManualReview,
      str(r.publish_status),
    )

    const dataObj: Record<string, unknown> = {
      clinicId,
      clinicName,
      slug: str(r.slug) || kebab(clinicName),
      tagline: str(r.tagline),
      description: str(r.description),
      clinicType: normalizeClinicType(str(r.clinic_type)),
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
      phone: phoneN.value,
      email: str(r.email),
      websiteUrl: str(r.website_url),
      bookingUrl: str(r.booking_url),
      instagramUrl: str(r.instagram_url),
      tiktokUrl: str(r.tiktok_url),
      facebookUrl: str(r.facebook_url),
      hoursJson: str(r.hours_json) ? safeJson(r.hours_json) : undefined,
      serviceType: str(r.service_type) ?? 'In-Person',
      acceptsInsurance: bool(r.accepts_insurance),
      paymentMethods: str(r.payment_methods),
      amenities: str(r.amenities),
      logoUrl: str(r.logo_url),
      clinicPhotoUrls: commaOrSemiListOfObj(r.clinic_photo_urls, 'url'),
      aggregateRating: num(r.aggregate_rating),
      aggregateRatingCount: int(r.aggregate_rating_count),
      yearEstablished: int(r.year_established),
      sourceUrls: commaOrSemiListOfObj(r.source_urls, 'url'),
      lastScrapedDate: isoDate(r.last_scraped_date),
      dataConfidence: num(r.data_confidence),
      needsManualReview,
      treatmentsOffered: treatmentIds.length > 0 ? treatmentIds : undefined,
      offersVirtualConsult: bool(r.offers_virtual_consult, false),
      acceptsNewPatients: bool(r.accepts_new_patients, true),
      startingPrice: num(r.starting_price),
      languages: list(r.languages),
      status: resolvedStatus,
      importBatch: ctx.batch,
    }

    const existing = await findOne(payload, 'clinics', 'clinicId', clinicId)
    if (ctx.dryRun) {
      maps.clinicIdToDocId[clinicId] = existing ? (existing as any).id : `dry:${clinicId}`
      if (existing) report.clinics.updated++
      else report.clinics.created++
      if (resolvedStatus === 'published') report.clinics.publishedCount++
      else if (resolvedStatus === 'review') report.clinics.reviewCount++
      else report.clinics.draftCount++
      continue
    }
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
      if (resolvedStatus === 'published') report.clinics.publishedCount++
      else if (resolvedStatus === 'review') report.clinics.reviewCount++
      else report.clinics.draftCount++
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

/** Create a coming-soon (or live, for launch states) metro Location for an unmatched city. */
async function autoCreateMetro(
  payload: Payload, city: string, code: string, maps: Maps, live: boolean, ctx: Ctx,
) {
  if (ctx.dryRun) return
  const slug = `${kebab(city)}-${code.toLowerCase()}`
  try {
    const existingLoc = await findOne(payload, 'locations', 'slug', slug)
    if (existingLoc) return
    const parent = maps.stateLocByCode[code]
    await payload.create({
      collection: 'locations',
      overrideAccess: true,
      data: {
        name: city,
        slug,
        kind: 'metro',
        state: code,
        parent: parent ? parent.id : undefined,
        isLive: live,
        noindex: !live,
        providerCount: 0,
      } as any,
    })
  } catch {
    /* non-fatal: a clinic still imports even if the Location create fails */
  }
}

async function importProviders(payload: Payload, rows: Row[], maps: Maps, report: ImportReport, ctx: Ctx) {
  const seenLicense: Record<string, string> = {} // fullName|state|number -> providerId
  const seenNpi: Record<string, { providerId: string; key: string }> = {}

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

    // Same NPI on a different person (name/license) is suspicious. Flag, still import.
    const npi = str(r.npi_number)
    if (npi) {
      const prev = seenNpi[npi]
      if (prev && prev.key !== dedupeKey) {
        report.alerts.push({
          alertKey: `dup-npi-${npi}`,
          type: 'duplicate_npi', severity: 'warning',
          message: `Providers ${prev.providerId} and ${providerId} share NPI ${npi} but differ by name/license. Review for a data error.`,
          collectionSlug: 'providers', documentId: providerId, relatedId: prev.providerId,
        })
      } else if (!prev) {
        seenNpi[npi] = { providerId, key: dedupeKey }
      }
    }

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

    const phoneN = normalizePhone(r.phone_direct)
    if (str(r.phone_direct) && !phoneN.valid) {
      report.alerts.push({
        alertKey: `provider-phone-${providerId}`,
        type: 'invalid_phone', severity: 'info',
        message: `Provider ${fullName} (${providerId}) has a non-standard phone "${str(r.phone_direct)}"; stored as-is.`,
        collectionSlug: 'providers', documentId: providerId,
      })
    }

    const providerPublishStatus = str(r.publish_status)?.toLowerCase().trim()
    const providerStatus: 'published' | 'review' | 'draft' =
      providerPublishStatus === 'draft' || providerPublishStatus === 'review'
        ? (providerPublishStatus as 'draft' | 'review')
        : 'published'

    const dataObj: Record<string, unknown> = {
      providerId,
      fullName,
      slug: providerSlug(fullName, credentials, str(r.city) ?? (clinicId ? maps.clinicIdToCity[clinicId] : undefined)),
      credentials,
      status: providerStatus,
      title: str(r.title),
      boardCertifications: listOfObj(r.board_certifications, 'name'),
      licenseNumber: licNum,
      licenseState: licState,
      licenseStatus: str(r.license_status) ?? 'Active',
      licenseVerificationUrl: str(r.license_verification_url),
      npiNumber: npi,
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
      phoneDirect: phoneN.value,
      instagramUrl: str(r.instagram_url),
      tiktokUrl: str(r.tiktok_url),
      linkedinUrl: str(r.linkedin_url),
      aggregateRating: num(r.aggregate_rating),
      aggregateRatingCount: int(r.aggregate_rating_count),
      sourceUrls: listOfObj(r.source_urls, 'url'),
      lastScrapedDate: isoDate(r.last_scraped_date),
      importBatch: ctx.batch,
    }

    const existing = await findOne(payload, 'providers', 'providerId', providerId)
    if (ctx.dryRun) {
      maps.providerIdToDocId[providerId] = existing ? (existing as any).id : `dry:${providerId}`
      if (existing) report.providers.updated++
      else report.providers.created++
      continue
    }
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
async function linkClinicProviders(payload: Payload, clinicRows: Row[], maps: Maps, ctx: Ctx) {
  if (ctx.dryRun) return
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

async function importReviews(payload: Payload, rows: Row[], maps: Maps, report: ImportReport, ctx: Ctx) {
  const reviewsPerClinic: Record<string, number> = {}
  const cap = ctx.maxReviewsPerClinic ?? 10

  for (const r of rows) {
    const reviewId = str(r.review_id)
    const clinicId = str(r.clinic_id)
    if (!reviewId) { report.reviews.skipped++; continue }

    if (clinicId) {
      reviewsPerClinic[clinicId] = (reviewsPerClinic[clinicId] ?? 0)
      if (reviewsPerClinic[clinicId] >= cap) { report.reviews.skipped++; continue }
    }

    let clinicDocId = clinicId ? maps.clinicIdToDocId[clinicId] : undefined
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
      clinicDocId = (existingClinic as any).id
      maps.clinicIdToDocId[clinicId!] = clinicDocId
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
      clinic: clinicDocId,
      reviewerFirstName: str(r.reviewer_first_name),
      reviewerInitial: str(r.reviewer_initial),
      reviewerAgeRange: str(r.reviewer_age_range),
      reviewerCity: str(r.reviewer_city),
      rating: int(r.rating),
      reviewTitle: str(r.review_title),
      reviewText: str(r.review_text) || str(r.review_excerpt),
      treatmentTag: str(r.treatment_tag),
      reviewDate: isoDate(r.review_date),
      sourcePlatform: str(r.source_platform),
      sourceUrl: str(r.source_url),
      responseFromProvider: str(r.response_from_provider),
      responseDate: isoDate(r.response_date),
      // Only mark verified when we have a source URL confirming provenance.
      // Hardcoding `true` would mark all imported reviews as verified regardless
      // of whether the original source was actually confirmed.
      verified: Boolean(str(r.source_url)),
      importBatch: ctx.batch,
    }

    const existing = await findOne(payload, 'reviews', 'reviewId', reviewId)
    if (ctx.dryRun) {
      if (existing) report.reviews.updated++
      else report.reviews.created++
      continue
    }
    try {
      if (existing) {
        // Re-imports do NOT change moderationStatus — preserve whatever admin set.
        await payload.update({ collection: 'reviews', id: (existing as any).id, data: clean(dataObj) as any })
        report.reviews.updated++
      } else {
        // New imports land as pending so an admin must approve before they go live.
        await payload.create({ collection: 'reviews', data: { ...clean(dataObj), moderationStatus: 'pending' } as any })
        report.reviews.created++
      }
      if (clinicId) reviewsPerClinic[clinicId] = (reviewsPerClinic[clinicId] ?? 0) + 1
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

/** Resolve a provider/clinic doc id from this run's map or the DB. */
async function resolveProvider(payload: Payload, maps: Maps, providerId: string | undefined) {
  if (!providerId) return undefined
  if (maps.providerIdToDocId[providerId]) return maps.providerIdToDocId[providerId]
  const found = await findOne(payload, 'providers', 'providerId', providerId)
  if (found) { maps.providerIdToDocId[providerId] = (found as any).id; return (found as any).id }
  return undefined
}
async function resolveClinic(payload: Payload, maps: Maps, clinicId: string | undefined) {
  if (!clinicId) return undefined
  if (maps.clinicIdToDocId[clinicId]) return maps.clinicIdToDocId[clinicId]
  const found = await findOne(payload, 'clinics', 'clinicId', clinicId)
  if (found) { maps.clinicIdToDocId[clinicId] = (found as any).id; return (found as any).id }
  return undefined
}

async function importPhotos(payload: Payload, rows: Row[], maps: Maps, report: ImportReport, ctx: Ctx) {
  for (const r of rows) {
    const photoId = str(r.photo_id)
    if (!photoId) { report.photos.skipped++; continue }

    // Skip photos the data source says we cannot publish.
    if (str(r.allowed_to_publish) === 'false' || str(r.allowed_to_publish) === '0') {
      report.photos.skipped++
      continue
    }

    const photoUrl = str(r.photo_url)
    const type = str(r.type)
    if (!photoUrl || !type) {
      report.photos.skipped++
      report.alerts.push({
        alertKey: `photo-missing-${photoId}`,
        type: 'other', severity: 'error',
        message: `Photo ${photoId} is missing photo_url or type. Skipped.`,
        collectionSlug: 'photos', documentId: photoId,
      })
      continue
    }

    const provIdRaw = str(r.provider_id)
    const clinicIdRaw = str(r.clinic_id)
    const providerDocId = await resolveProvider(payload, maps, provIdRaw)
    const clinicDocId = await resolveClinic(payload, maps, clinicIdRaw)

    if (provIdRaw && !providerDocId) {
      report.alerts.push({
        alertKey: `photo-provider-${photoId}`,
        type: 'broken_relationship', severity: 'warning',
        message: `Photo ${photoId} names provider_id ${provIdRaw} which does not exist. Attached to clinic only.`,
        collectionSlug: 'photos', documentId: photoId, relatedId: provIdRaw,
      })
    }
    if (clinicIdRaw && !clinicDocId) {
      report.alerts.push({
        alertKey: `photo-clinic-${photoId}`,
        type: 'broken_relationship', severity: 'warning',
        message: `Photo ${photoId} names clinic_id ${clinicIdRaw} which does not exist.`,
        collectionSlug: 'photos', documentId: photoId, relatedId: clinicIdRaw,
      })
    }
    if (!providerDocId && !clinicDocId) {
      report.photos.skipped++
      report.alerts.push({
        alertKey: `photo-orphan-${photoId}`,
        type: 'broken_relationship', severity: 'error',
        message: `Photo ${photoId} references neither an existing provider nor clinic. Skipped.`,
        collectionSlug: 'photos', documentId: photoId,
      })
      continue
    }
    if (!str(r.source_url)) {
      report.alerts.push({
        alertKey: `photo-nosource-${photoId}`,
        type: 'missing_source', severity: 'warning',
        message: `Photo ${photoId} has no source_url (audit trail missing).`,
        collectionSlug: 'photos', documentId: photoId,
      })
    }

    const dataObj: Record<string, unknown> = {
      photoId,
      provider: providerDocId,
      clinic: clinicDocId,
      treatmentTag: str(r.treatment_tag),
      photoUrl,
      type,
      pairId: str(r.pair_id),
      weeksPostTreatment: int(r.weeks_post_treatment),
      caption: str(r.caption),
      consentDocumented: bool(r.consent_documented),
      sourcePlatform: str(r.source_platform),
      // CSV may use original_page_url or source_url depending on scraper version.
      sourceUrl: str(r.original_page_url) || str(r.source_url),
      importBatch: ctx.batch,
    }

    const existing = await findOne(payload, 'photos', 'photoId', photoId)
    if (ctx.dryRun) {
      if (existing) report.photos.updated++
      else report.photos.created++
      continue
    }
    try {
      if (existing) {
        await payload.update({ collection: 'photos', id: (existing as any).id, data: clean(dataObj) as any })
        report.photos.updated++
      } else {
        await payload.create({ collection: 'photos', data: clean(dataObj) as any })
        report.photos.created++
      }
    } catch (err: any) {
      report.photos.skipped++
      report.alerts.push({
        alertKey: `photo-fail-${photoId}`,
        type: 'other', severity: 'error',
        message: `Failed to import photo ${photoId}: ${err.message}`,
        collectionSlug: 'photos', documentId: photoId,
      })
    }
  }
}

async function importQA(payload: Payload, rows: Row[], maps: Maps, report: ImportReport, ctx: Ctx) {
  for (const r of rows) {
    const qaId = str(r.qa_id)
    const questionTitle = str(r.question_title)
    if (!qaId || !questionTitle) {
      report.qa.skipped++
      report.alerts.push({
        alertKey: `qa-missing-${qaId ?? Math.random()}`,
        type: 'other', severity: 'error',
        message: `Q&A row missing qa_id or question_title (id: ${qaId ?? 'unknown'}). Skipped.`,
        collectionSlug: 'qa', documentId: qaId,
      })
      continue
    }

    const answerText = str(r.answer_text)
    const provIdRaw = str(r.answered_by_provider_id)
    const providerDocId = await resolveProvider(payload, maps, provIdRaw)
    if (provIdRaw && !providerDocId) {
      report.alerts.push({
        alertKey: `qa-provider-${qaId}`,
        type: 'broken_relationship', severity: 'warning',
        message: `Q&A ${qaId} names answered_by_provider_id ${provIdRaw} which does not exist. Falling back to answered_by_name.`,
        collectionSlug: 'qa', documentId: qaId, relatedId: provIdRaw,
      })
    }

    const existing = await findOne(payload, 'qa', 'qaId', qaId)
    // Stable slug: reuse the existing record's slug on re-import; for new rows
    // derive from the title and disambiguate against any other record's slug.
    let slug: string
    if (existing && (existing as any).slug) {
      slug = (existing as any).slug
    } else {
      const base = kebab(questionTitle).slice(0, 70) || kebab(qaId)
      const clash = await findOne(payload, 'qa', 'slug', base)
      slug = clash && (clash as any).qaId !== qaId ? `${base}-${kebab(qaId)}` : base
    }

    const dataObj: Record<string, unknown> = {
      qaId,
      slug,
      status: answerText ? 'answered' : 'new',
      questionTitle,
      questionText: str(r.question_text),
      answeredByProvider: providerDocId,
      answeredByName: str(r.answered_by_name),
      answerText,
      treatmentTag: str(r.treatment_tag),
      cityTag: str(r.city_tag),
      sourcePlatform: str(r.source_platform) ?? 'directory',
      sourceUrl: str(r.source_url),
      date: isoDate(r.date),
      importBatch: ctx.batch,
    }

    if (ctx.dryRun) {
      if (existing) report.qa.updated++
      else report.qa.created++
      continue
    }
    try {
      if (existing) {
        await payload.update({ collection: 'qa', id: (existing as any).id, data: clean(dataObj) as any, overrideAccess: true })
        report.qa.updated++
      } else {
        await payload.create({ collection: 'qa', data: clean(dataObj) as any, overrideAccess: true })
        report.qa.created++
      }
    } catch (err: any) {
      report.qa.skipped++
      report.alerts.push({
        alertKey: `qa-fail-${qaId}`,
        type: 'other', severity: 'error',
        message: `Failed to import Q&A ${qaId}: ${err.message}`,
        collectionSlug: 'qa', documentId: qaId,
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
