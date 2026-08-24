import type { Payload } from 'payload'
import { upsertAlert, reconcileAlerts, type AlertInput } from './import-data'
import { normalizeCity, kebab, isValidZip, isValidLat, isValidLng, normalizePhone, validateZipLocation } from './helpers'

export type ScanResult = {
  alerts: AlertInput[]
  bySeverity: Record<string, number>
  scanned: { clinics: number; promotions: number }
}

/**
 * DB-wide data-integrity scan. Re-checks every persisted record and upserts
 * DataAlerts (by alertKey, so re-runs update instead of duplicating). Detects:
 * duplicate clinics (googlePlaceId), clinics whose city has no metro Location, missing
 * provider photo, malformed zip/coords/phone, duplicate NPI, likely branches
 * (same name + phone/website across distinct place ids), and promotion health.
 *
 * Shared by `scripts/scan-data-alerts.ts` (CLI) and `/api/admin/scan` (button).
 */
export async function runScan(payload: Payload): Promise<ScanResult> {
  const alerts: AlertInput[] = []
  const pool = (payload.db as any).pool

  const [clinics, promotions, metros] = await Promise.all([
    payload.find({ collection: 'clinics', limit: 25000, depth: 0 }),
    payload.find({ collection: 'promotions', limit: 1000, depth: 0 }),
    payload.find({ collection: 'locations', where: { kind: { equals: 'metro' } } as any, limit: 5000, depth: 0 }),
  ])

  const metroCities = new Set<string>()
  for (const m of metros.docs as any[]) if (m.name && m.state) metroCities.add(`${normalizeCity(m.name)}|${m.state}`)

  // Duplicate clinics by googlePlaceId + city match + zip/coords/phone validity
  // + likely-branch grouping.
  const placeSeen: Record<string, string> = {}
  const branchByNamePhone: Record<string, any[]> = {}
  const branchByNameSite: Record<string, any[]> = {}
  for (const c of clinics.docs as any[]) {
    if (c.googlePlaceId) {
      if (placeSeen[c.googlePlaceId]) {
        alerts.push({
          alertKey: `scan-dup-clinic-${c.googlePlaceId}`,
          type: 'duplicate_clinic', severity: 'warning',
          message: `Clinics ${placeSeen[c.googlePlaceId]} and ${c.clinicId} share google_place_id ${c.googlePlaceId}.`,
          collectionSlug: 'clinics', documentId: c.clinicId, relatedId: placeSeen[c.googlePlaceId],
        })
      } else placeSeen[c.googlePlaceId] = c.clinicId
    }

    if (c.city && c.state && !metroCities.has(`${normalizeCity(c.city)}|${c.state}`)) {
      alerts.push({
        alertKey: `scan-clinic-city-${c.clinicId}`,
        type: 'unmatched_city', severity: 'info',
        message: `Clinic ${c.clinicName} is in ${c.city}, ${c.state} with no metro Location; not shown on any city page.`,
        collectionSlug: 'clinics', documentId: c.clinicId,
      })
    }

    if (c.zip && !isValidZip(String(c.zip))) {
      alerts.push({
        alertKey: `scan-clinic-zip-${c.clinicId}`,
        type: 'invalid_zip', severity: 'warning',
        message: `Clinic ${c.clinicName} (${c.clinicId}) has an invalid ZIP "${c.zip}".`,
        collectionSlug: 'clinics', documentId: c.clinicId,
      })
    }

    const zipMismatch = await validateZipLocation(c.zip ? String(c.zip) : undefined, c.city, c.state, pool)
    if (zipMismatch) {
      alerts.push({
        alertKey: `scan-clinic-zip-mismatch-${c.clinicId}`,
        type: 'zip_location_mismatch', severity: 'warning',
        message: `Clinic ${c.clinicName} (${c.clinicId}): ${zipMismatch}.`,
        collectionSlug: 'clinics', documentId: c.clinicId,
      })
    }
    if (!isValidLat(c.latitude) || !isValidLng(c.longitude)) {
      alerts.push({
        alertKey: `scan-clinic-coords-${c.clinicId}`,
        type: 'invalid_coordinates', severity: 'warning',
        message: `Clinic ${c.clinicName} (${c.clinicId}) has out-of-range coordinates (${c.latitude}, ${c.longitude}).`,
        collectionSlug: 'clinics', documentId: c.clinicId,
      })
    }
    if (c.phone && !normalizePhone(String(c.phone)).valid) {
      alerts.push({
        alertKey: `scan-clinic-phone-${c.clinicId}`,
        type: 'invalid_phone', severity: 'info',
        message: `Clinic ${c.clinicName} (${c.clinicId}) has a non-standard phone "${c.phone}".`,
        collectionSlug: 'clinics', documentId: c.clinicId,
      })
    }

    // Group for branch detection (only across DISTINCT place ids). Branches of
    // one brand share a phone/website but their names differ by a city suffix
    // (e.g. "Lone Star Med Spa Austin" vs "... Dallas"), so we key on the brand
    // prefix + phone (not the full name) and on the website alone.
    const nameKey = kebab(String(c.clinicName ?? ''))
    const brandToken = nameKey.split('-').slice(0, 2).join('-') // first two words = brand prefix
    if (brandToken && c.phone) {
      const k = `${brandToken}|${String(c.phone).replace(/\D/g, '')}`
      ;(branchByNamePhone[k] ??= []).push(c)
    }
    if (c.websiteUrl) {
      const site = String(c.websiteUrl).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '')
      if (site) (branchByNameSite[site] ??= []).push(c)
    }
  }

  raiseBranchAlerts(alerts, branchByNamePhone, 'phone')
  raiseBranchAlerts(alerts, branchByNameSite, 'website')

  // Promotion health: expiry, scope, image, and clinic links.
  const now = Date.now()
  for (const promo of promotions.docs as any[]) {
    if (promo.status !== 'active') continue
    const placement: string = promo.placement ?? 'sponsored-card'
    const promoLabel = promo.title ?? promo.id

    if (promo.endDate && new Date(promo.endDate).getTime() < now) {
      alerts.push({
        alertKey: `scan-expired-promo-${promo.id}`,
        type: 'promo_expired', severity: 'warning',
        message: `Promotion "${promoLabel}" expired on ${String(promo.endDate).slice(0, 10)} but was still active. Auto-deactivated.`,
        collectionSlug: 'promotions', documentId: String(promo.id),
      })
      try {
        await payload.update({ collection: 'promotions', id: promo.id, data: { status: 'expired' }, overrideAccess: true })
      } catch {
        /* non-fatal */
      }
      continue
    }

    // Expiring within 7 days
    if (promo.endDate) {
      const daysLeft = (new Date(promo.endDate).getTime() - now) / 86400000
      if (daysLeft > 0 && daysLeft <= 7) {
        alerts.push({
          alertKey: `scan-promo-expiring-${promo.id}`,
          type: 'promo_expiring_soon', severity: 'warning',
          message: `Active promotion "${promoLabel}" expires in ${Math.ceil(daysLeft)} day${Math.ceil(daysLeft) === 1 ? '' : 's'} (${String(promo.endDate).slice(0, 10)}).`,
          collectionSlug: 'promotions', documentId: String(promo.id),
        })
      }
    }

    const scopeType: string = promo.scope ?? ''
    const needsService = ['service', 'service+state', 'service+city'].includes(scopeType)
    const needsState = ['state', 'service+state'].includes(scopeType)
    const needsCity = ['city', 'service+city'].includes(scopeType)
    if (
      (needsService && !promo.service) ||
      (needsState && !promo.state) ||
      (needsCity && !promo.city)
    ) {
      alerts.push({
        alertKey: `scan-promo-scope-${promo.id}`,
        type: 'promo_scope_mismatch', severity: 'warning',
        message: `Active promotion "${promoLabel}" has scope "${scopeType}" but is missing its required scope target (service / state / city).`,
        collectionSlug: 'promotions', documentId: String(promo.id),
      })
    }

    if (placement === 'banner') {
      if (!promo.bannerImage) {
        alerts.push({
          alertKey: `scan-banner-noimage-${promo.id}`,
          type: 'promo_missing_image', severity: 'warning',
          message: `Active ad banner "${promoLabel}" has no banner image; it falls back to a text-only block.`,
          collectionSlug: 'promotions', documentId: String(promo.id),
        })
      }
      continue
    }

    const clinicRelId = typeof promo.clinic === 'object' ? promo.clinic?.id : promo.clinic
    if (!clinicRelId) {
      alerts.push({
        alertKey: `scan-promo-noclinic-${promo.id}`,
        type: 'promo_missing_provider', severity: 'error',
        message: `Active ${placement} "${promoLabel}" has no clinic set; it cannot render. A paid slot may be unfulfilled.`,
        collectionSlug: 'promotions', documentId: String(promo.id),
      })
    }
  }

  // Slot-exceeded check: count active promos per placement×scope; flag if over limit
  const SLOT_LIMITS: Record<string, number> = { banner: 1, 'sponsored-card': 3, 'featured-pin': 3, 'organic-pin': 3 }
  const slotCounts: Record<string, number> = {}
  for (const promo of promotions.docs as any[]) {
    if (promo.status !== 'active') continue
    const placement = promo.placement ?? 'sponsored-card'
    const scopeKey = [promo.scope ?? '', promo.service ?? '', promo.state ?? '', promo.city ?? ''].join('|')
    const key = `${placement}|${scopeKey}`
    slotCounts[key] = (slotCounts[key] ?? 0) + 1
    const limit = SLOT_LIMITS[placement] ?? 999
    if (slotCounts[key] === limit + 1) {
      const scopeDesc = [promo.scope, promo.state, promo.city].filter(Boolean).join(' / ')
      alerts.push({
        alertKey: `scan-slot-exceeded-${placement}-${scopeKey}`,
        type: 'promo_slot_exceeded', severity: 'warning',
        message: `Slot "${placement}" for scope "${scopeDesc || 'global'}" has ${slotCounts[key]} active promotions (limit: ${limit}). Only ${limit} will render.`,
        collectionSlug: 'promotions', documentId: String(promo.id),
      })
    }
  }

  for (const a of alerts) await upsertAlert(payload, a, 'scan')
  await reconcileAlerts(payload, 'scan', new Set(alerts.map((a) => a.alertKey)))

  const bySeverity = alerts.reduce<Record<string, number>>((acc, a) => {
    acc[a.severity] = (acc[a.severity] ?? 0) + 1
    return acc
  }, {})

  return {
    alerts,
    bySeverity,
    scanned: {
      clinics: clinics.totalDocs,
      promotions: promotions.totalDocs,
    },
  }
}

/** Raise one possible_branch info alert per group of same-name clinics that
 * share a phone/website but have distinct google_place_ids (true branches, not
 * duplicates). Never merges; flags for human review (full merge is Phase 6). */
function raiseBranchAlerts(alerts: AlertInput[], groups: Record<string, any[]>, by: 'phone' | 'website') {
  for (const [k, members] of Object.entries(groups)) {
    if (members.length < 2) continue
    const placeIds = new Set(members.map((m) => m.googlePlaceId).filter(Boolean))
    // Need distinct place ids (>=2) to call them branches, not the same listing.
    if (placeIds.size < 2) continue
    // Self-heal: once every member is linked under one brand, stop flagging them.
    const brandRefs = members.map((m) =>
      m.brand == null ? null : typeof m.brand === 'object' ? m.brand.id : m.brand,
    )
    if (brandRefs.every((b) => b != null && b === brandRefs[0])) continue
    const ids = members.map((m) => m.clinicId).join(', ')
    alerts.push({
      alertKey: `scan-branch-${by}-${kebab(k)}`,
      type: 'possible_branch', severity: 'info',
      message: `Clinics ${ids} share the same name and ${by} across different locations; they may be branches of one brand. Review before linking (never merged automatically).`,
      collectionSlug: 'clinics', documentId: members[0].clinicId,
    })
  }
}
