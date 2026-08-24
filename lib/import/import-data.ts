import type { Payload } from 'payload'
import {
  type Row,
  str, num, int, bool, isoDate, list, listOfObj, commaOrSemiList, commaOrSemiListOfObj, titleCase,
  kebab, providerSlug, clinicSlug, normalizeCity, brandSlugFor, serviceSlugFor,
  isValidZip, isValidLat, isValidLng, normalizePhone, validateZipLocation,
  classifyCityValue, classifyAddressValue,
} from './helpers'

export type AlertInput = {
  alertKey: string
  type:
    | 'duplicate_clinic' | 'duplicate_provider' | 'missing_coordinates' | 'missing_source'
    | 'unknown_treatment' | 'broken_relationship' | 'unmatched_city' | 'missing_trust_field'
    | 'invalid_zip' | 'zip_location_mismatch' | 'invalid_coordinates' | 'invalid_phone' | 'duplicate_npi' | 'possible_branch'
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
  servicesAutoCreated: string[]
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
  serviceSlugToId: Record<string, any>
  brandSlugToId: Record<string, any>
  metroCities: Set<string> // normalized "city|ST"
  stateLocByCode: Record<string, any> // "ST" -> state Location doc (for auto-created metros' parent)
  clinicIdToDocId: Record<string, any>
  clinicIdToCity: Record<string, string>
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
    clinics: { created: 0, updated: 0, skipped: 0, publishedCount: 0, reviewCount: 0, draftCount: 0, servicesAutoCreated: [] },
    providers: { created: 0, updated: 0, skipped: 0 },
    reviews: { created: 0, updated: 0, skipped: 0 },
    photos: { created: 0, updated: 0, skipped: 0 },
    qa: { created: 0, updated: 0, skipped: 0 },
    alerts,
    dryRun: ctx.dryRun,
    batch: ctx.batch,
  }

  // Preload lookup maps.
  const [servicesRes, brandsRes] = await Promise.all([
    payload.find({ collection: 'services', limit: 1000, depth: 0 }),
    payload.find({ collection: 'brands', limit: 200, depth: 0 }),
  ])
  const serviceSlugToId: Record<string, any> = {}
  for (const t of servicesRes.docs as any[]) serviceSlugToId[t.slug] = t.id
  const brandSlugToId: Record<string, any> = {}
  for (const b of brandsRes.docs as any[]) brandSlugToId[b.slug] = b.id

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
    serviceSlugToId, brandSlugToId, metroCities, stateLocByCode,
    clinicIdToDocId: {}, clinicIdToCity: {},
    zipToCity,
  }

  if (data.clinics) await importClinics(payload, data.clinics, maps, report, ctx)
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
  const pool = (payload.db as any).pool
  // Aggregate directly in SQL — avoids loading 100k+ provider rows into Node heap.
  const [stateRows, cityRows] = await Promise.all([
    pool.query(`
      SELECT UPPER(c.state) AS st, COUNT(*)::int AS cnt
      FROM providers p
      JOIN clinics c ON c.id = p.clinic_id
      WHERE c.state IS NOT NULL AND c.state <> ''
      GROUP BY UPPER(c.state)
    `).then((r: any) => r.rows as { st: string; cnt: number }[]).catch(() => [] as { st: string; cnt: number }[]),
    pool.query(`
      SELECT UPPER(c.state) AS st, c.city, COUNT(*)::int AS cnt
      FROM providers p
      JOIN clinics c ON c.id = p.clinic_id
      WHERE c.city IS NOT NULL AND c.city <> '' AND c.state IS NOT NULL AND c.state <> ''
      GROUP BY UPPER(c.state), c.city
    `).then((r: any) => r.rows as { st: string; city: string; cnt: number }[]).catch(() => [] as { st: string; city: string; cnt: number }[]),
  ])

  const byState: Record<string, number> = {}
  for (const row of stateRows) byState[row.st] = Number(row.cnt)
  const byCity: Record<string, number> = {}
  for (const row of cityRows) byCity[`${normalizeCity(row.city)}|${row.st}`] = Number(row.cnt)

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
  const PAGE = 500
  let page = 1
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const prior = await payload.find({
      collection: 'data-alerts',
      where: { and: [{ source: { equals: source } }, { status: { not_equals: 'resolved' } }] } as any,
      limit: PAGE,
      page,
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
    if (!prior.hasNextPage) break
    page++
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

async function resolveOrCreateService(
  payload: Payload,
  rawValue: string,
  maps: Maps,
  servicesAutoCreated: string[],
  ctx: Ctx,
  alerts: AlertInput[],
): Promise<number | undefined> {
  const trimmed = rawValue.trim()
  if (!trimmed) return undefined

  const lookupSlug = serviceSlugFor(trimmed) ?? kebab(trimmed)
  if (!lookupSlug) return undefined

  if (maps.serviceSlugToId[lookupSlug] !== undefined) return maps.serviceSlugToId[lookupSlug]

  const found = await findOne(payload, 'services', 'slug', lookupSlug)
  if (found) {
    maps.serviceSlugToId[lookupSlug] = (found as any).id
    return (found as any).id
  }

  if (ctx.dryRun) return undefined

  const name = titleCase(trimmed)
  try {
    const created = await payload.create({
      collection: 'services',
      overrideAccess: true,
      data: { name, slug: lookupSlug, category: 'other' } as any,
    })
    const newId = (created as any).id
    maps.serviceSlugToId[lookupSlug] = newId
    if (!servicesAutoCreated.includes(name)) servicesAutoCreated.push(name)
    alerts.push({
      alertKey: `auto-service-${lookupSlug}`,
      type: 'other',
      severity: 'warning',
      message: `Auto-created service "${name}" (slug: "${lookupSlug}") from CSV import. Review category and description.`,
      collectionSlug: 'services',
      documentId: String(newId),
    })
    return newId
  } catch {
    return undefined
  }
}

async function resolveOrCreateBrand(
  payload: Payload,
  rawValue: string,
  maps: Maps,
  ctx: Ctx,
  alerts: AlertInput[],
): Promise<number | undefined> {
  const trimmed = rawValue.trim()
  if (!trimmed) return undefined

  const lookupSlug = brandSlugFor(trimmed) ?? kebab(trimmed)
  if (!lookupSlug) return undefined

  if (maps.brandSlugToId[lookupSlug] !== undefined) return maps.brandSlugToId[lookupSlug]

  const found = await findOne(payload, 'brands', 'slug', lookupSlug)
  if (found) {
    maps.brandSlugToId[lookupSlug] = (found as any).id
    return (found as any).id
  }

  if (ctx.dryRun) return undefined

  const name = titleCase(trimmed)
  try {
    const created = await payload.create({
      collection: 'brands',
      overrideAccess: true,
      data: { name, slug: lookupSlug, category: 'other' } as any,
    })
    const newId = (created as any).id
    maps.brandSlugToId[lookupSlug] = newId
    alerts.push({
      alertKey: `auto-brand-${lookupSlug}`,
      type: 'other',
      severity: 'warning',
      message: `Auto-created brand "${name}" (slug: "${lookupSlug}") from CSV import. Review category and manufacturer.`,
      collectionSlug: 'brands',
      documentId: String(newId),
    })
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
  const pool = (payload.db as any).pool

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

    // Cross-check the ZIP against the zip_codes reference table: does it exist, and
    // does its real city/state match what this row claims? Catches "Houston, TX"
    // with a Newark ZIP, which the format-only check above cannot.
    const zipMismatch = await validateZipLocation(r.zip, r.city, r.state, pool)
    if (zipMismatch) {
      report.alerts.push({
        alertKey: `clinic-zip-mismatch-${clinicId}`,
        type: 'zip_location_mismatch', severity: 'warning',
        message: `Clinic ${clinicName} (${clinicId}): ${zipMismatch}.`,
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
    // A shifted CSV column can put review prose here. Never store that: it
    // becomes a public city name, an auto-created metro Location and a slug.
    // The ZIP is the reliable fallback, and in both real cases it was correct.
    const cityVerdict = classifyCityValue(rawCity)
    if (cityVerdict === 'prose') {
      report.alerts.push({
        alertKey: `clinic-city-prose-${clinicId}`,
        type: 'unmatched_city', severity: 'warning',
        message:
          `Clinic ${clinicName} (${clinicId}) had text in the city column that is not a city name ` +
          `("${(rawCity ?? '').slice(0, 60)}..."). Likely a shifted CSV column. ` +
          (maps.zipToCity[zip5]
            ? `Used "${maps.zipToCity[zip5]}" from ZIP ${zip5} instead.`
            : `ZIP ${zip5 || '(none)'} did not resolve either, so the city was left empty.`),
        collectionSlug: 'clinics', documentId: clinicId,
      })
    }
    const city = (() => {
      if (!rawCity) return undefined
      if (cityVerdict === 'prose') return maps.zipToCity[zip5] ?? undefined
      if (/^[A-Z]{2}\s+\d{5}$/.test(rawCity)) {
        return maps.zipToCity[zip5] ?? undefined
      }
      // Some scraped sources send the city ALL CAPS ("SPRING") or all lowercase.
      // Normalize to Title Case so it displays consistently and so the metro
      // Location auto-created below (name: city) doesn't inherit the bad casing.
      return /[a-z]/.test(rawCity) ? rawCity : titleCase(rawCity.toLowerCase())
    })()
    const state = str(r.state)

    // The other half of a shifted row. Prose is dropped (an address field is
    // not a place to keep a review); "suspicious" is kept and only flagged,
    // because some rows legitimately carry a note like "Second floor, no
    // street-facing storefront" and deleting those would lose real data.
    const rawAddress = str(r.address_line_1)
    const addressVerdict = classifyAddressValue(rawAddress)
    const addressLine1 = addressVerdict === 'prose' ? undefined : rawAddress
    if (addressVerdict !== 'clean') {
      report.alerts.push({
        alertKey: `clinic-address-prose-${clinicId}`,
        type: 'other',
        severity: addressVerdict === 'prose' ? 'warning' : 'info',
        message:
          addressVerdict === 'prose'
            ? `Clinic ${clinicName} (${clinicId}) had prose in address_line_1 ("${(rawAddress ?? '').slice(0, 60)}..."); dropped. Likely a shifted CSV column, so check city and ZIP on this row too.`
            : `Clinic ${clinicName} (${clinicId}) has an address_line_1 with no street number ("${(rawAddress ?? '').slice(0, 60)}"); stored as-is, please review.`,
        collectionSlug: 'clinics', documentId: clinicId,
      })
    }

    if (city) maps.clinicIdToCity[clinicId] = city
    if (city && state) {
      const code = state.toUpperCase()
      const key = `${normalizeCity(city)}|${code}`
      if (!maps.metroCities.has(key)) {
        // A clinic is being imported into this city right now, so it trivially
        // has data -- markets are live purely because data exists (no manual
        // per-state launch step; `npm run scan:pages` reconciles this exactly
        // afterward regardless, this just avoids a brief "coming soon" flash).
        const live = true
        await autoCreateMetro(payload, city, code, maps, live, ctx)
        maps.metroCities.add(key)
        report.alerts.push({
          alertKey: `clinic-city-${clinicId}`,
          type: 'unmatched_city', severity: 'info',
          message: `Clinic ${clinicName} is in ${city}, ${code} which had no metro Location; one was auto-created and set live.`,
          collectionSlug: 'clinics', documentId: clinicId,
        })
      }
    }

    // Phase 1 fields — parse before building dataObj
    const needsManualReview = true

    const serviceIds: any[] = []
    const clinicBrandIds: any[] = []
    for (const raw of commaOrSemiList(r.treatment_ids)) {
      const norm = raw.toLowerCase().trim()
      if (brandSlugFor(norm) !== null) {
        const id = await resolveOrCreateBrand(payload, raw, maps, ctx, report.alerts)
        if (id !== undefined && !clinicBrandIds.includes(id)) clinicBrandIds.push(id)
      } else {
        const id = await resolveOrCreateService(payload, raw, maps, report.clinics.servicesAutoCreated, ctx, report.alerts)
        if (id !== undefined && !serviceIds.includes(id)) serviceIds.push(id)
      }
    }

    const resolvedStatus = 'draft' as const

    const dataObj: Record<string, unknown> = {
      clinicId,
      clinicName,
      // Slug = clinic-name + ZIP (LOCKED 2026-08-04, never city/state — those
      // are already path segments). The CSV-provided slug is deliberately
      // ignored: this source tool's `slug` column names a DIFFERENT business
      // from the row's own clinic_name in 19-25% of rows (measured across
      // four batches), which cost the dysport batch 745 rows to collisions.
      // Collisions on the derived slug are resolved by the unique constraint
      // + the -N suffixing in lib/clinic-slug-hook.ts.
      slug: clinicSlug(clinicName, str(r.zip)) || kebab(clinicName),
      tagline: str(r.tagline),
      description: str(r.description),
      clinicType: normalizeClinicType(str(r.clinic_type)),
      addressLine1: addressLine1,
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
      acceptsInsurance: bool(r.accepts_insurance),
      paymentMethods: str(r.payment_methods),
      amenities: str(r.amenities),
      logoUrl: str(r.logo_url),
      clinicPhotoUrls: commaOrSemiListOfObj(r.clinic_photo_urls, 'url'),
      aggregateRating: num(r.aggregate_rating),
      aggregateRatingCount: int(r.aggregate_rating_count),
      sourceUrls: commaOrSemiListOfObj(r.source_urls, 'url'),
      lastScrapedDate: isoDate(r.last_scraped_date),
      dataConfidence: num(r.data_confidence),
      needsManualReview,
      servicesOffered: serviceIds.length > 0 ? serviceIds : undefined,
      brandsOffered: clinicBrandIds.length > 0 ? clinicBrandIds : undefined,
      startingPrice: num(r.starting_price),
      status: resolvedStatus,
      importBatch: ctx.batch,
    }

    const existing = await findOne(payload, 'clinics', 'clinicId', clinicId)
    if (ctx.dryRun) {
      maps.clinicIdToDocId[clinicId] = existing ? (existing as any).id : `dry:${clinicId}`
      if (existing) report.clinics.updated++
      else report.clinics.created++
      report.clinics.draftCount++
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
      report.clinics.draftCount++
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

/** Create a metro Location for an unmatched city (live -- a clinic is being imported there). */
async function autoCreateMetro(
  payload: Payload, city: string, code: string, maps: Maps, live: boolean, ctx: Ctx,
) {
  if (ctx.dryRun) return
  // Never slug from a raw "CA 90210"/ZIP string - only create for a real city name.
  if (/\d/.test(city) || city.trim().length < 2) return
  // Last line of defence, independent of the caller: a shifted CSV column once
  // created a metro named after a 223-character review, with a 218-character
  // slug, and it surfaced in the public city filter list. Nothing that fails
  // classifyCityValue may become a Location, whatever the caller believed.
  if (classifyCityValue(city) !== 'clean') return
  const slug = `${kebab(city)}-${code.toLowerCase()}`
  try {
    // Dedupe by NAME + STATE (not just slug). A metro named "Los Angeles", CA must
    // never be created twice even if an older row used a ZIP-based slug. This is what
    // produced hundreds of duplicate ZIP-city Locations before.
    const byName = await payload.find({
      collection: 'locations',
      where: { and: [{ name: { equals: city } }, { state: { equals: code } }, { kind: { in: ['metro', 'city'] } }] },
      limit: 1, depth: 0,
    })
    if (byName.docs.length > 0) return
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

// Reviews are imported separately by scripts/import-reviews.ts. The combined
// provider importer intentionally ignores review rows so provider_id is never
// used to attach reviews.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function importReviews(_payload: Payload, _rows: Row[], _maps: Maps, _report: ImportReport, _ctx: Ctx) {
  // no-op: run `npm run import:reviews -- --csv=...` after clinics exist.
}

/** Resolve a provider/clinic doc id from this run's map or the DB. */
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

    const clinicIdRaw = str(r.clinic_id)
    const clinicDocId = await resolveClinic(payload, maps, clinicIdRaw)

    if (clinicIdRaw && !clinicDocId) {
      report.alerts.push({
        alertKey: `photo-clinic-${photoId}`,
        type: 'broken_relationship', severity: 'warning',
        message: `Photo ${photoId} names clinic_id ${clinicIdRaw} which does not exist.`,
        collectionSlug: 'photos', documentId: photoId, relatedId: clinicIdRaw,
      })
    }
    if (!clinicDocId) {
      report.photos.skipped++
      report.alerts.push({
        alertKey: `photo-orphan-${photoId}`,
        type: 'broken_relationship', severity: 'error',
        message: `Photo ${photoId} references no existing clinic. Skipped.`,
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
      clinic: clinicDocId,
      serviceTag: str(r.service_tag),
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
      answeredByName: str(r.answered_by_name),
      answerText,
      serviceTag: str(r.service_tag),
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

