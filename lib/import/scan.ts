import type { Payload } from 'payload'
import { upsertAlert, reconcileAlerts, type AlertInput } from './import-data'
import { normalizeCity, kebab, isValidZip, isValidLat, isValidLng, normalizePhone } from './helpers'

export type ScanResult = {
  alerts: AlertInput[]
  bySeverity: Record<string, number>
  scanned: { clinics: number; providers: number; promotions: number }
}

/**
 * DB-wide data-integrity scan. Re-checks every persisted record and upserts
 * DataAlerts (by alertKey, so re-runs update instead of duplicating). Detects:
 * duplicate clinics (googlePlaceId), duplicate providers (name+state+license),
 * providers without a clinic, clinics whose city has no metro Location, missing
 * provider photo, malformed zip/coords/phone, duplicate NPI, likely branches
 * (same name + phone/website across distinct place ids), and promotion health.
 *
 * Shared by `scripts/scan-data-alerts.ts` (CLI) and `/api/admin/scan` (button).
 */
export async function runScan(payload: Payload): Promise<ScanResult> {
  const alerts: AlertInput[] = []

  const [clinics, providers, promotions, metros] = await Promise.all([
    payload.find({ collection: 'clinics', limit: 100000, depth: 0 }),
    payload.find({ collection: 'providers', limit: 100000, depth: 0 }),
    payload.find({ collection: 'promotions', limit: 100000, depth: 0 }),
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

  // Duplicate providers + missing clinic + missing photo + dup NPI + bad phone
  const licSeen: Record<string, string> = {}
  const npiSeen: Record<string, { providerId: string; key: string }> = {}
  for (const p of providers.docs as any[]) {
    const key = `${String(p.fullName).toLowerCase()}|${p.licenseState}|${p.licenseNumber}`
    if (licSeen[key]) {
      alerts.push({
        alertKey: `scan-dup-provider-${key}`,
        type: 'duplicate_provider', severity: 'warning',
        message: `Providers ${licSeen[key]} and ${p.providerId} share name + state + license (${p.licenseNumber}).`,
        collectionSlug: 'providers', documentId: p.providerId, relatedId: licSeen[key],
      })
    } else licSeen[key] = p.providerId

    if (p.npiNumber) {
      const prev = npiSeen[p.npiNumber]
      if (prev && prev.key !== key) {
        alerts.push({
          alertKey: `scan-dup-npi-${p.npiNumber}`,
          type: 'duplicate_npi', severity: 'warning',
          message: `Providers ${prev.providerId} and ${p.providerId} share NPI ${p.npiNumber} but differ by name/license.`,
          collectionSlug: 'providers', documentId: p.providerId, relatedId: prev.providerId,
        })
      } else if (!prev) npiSeen[p.npiNumber] = { providerId: p.providerId, key }
    }

    if (!p.clinic) {
      alerts.push({
        alertKey: `scan-provider-noclinic-${p.providerId}`,
        type: 'broken_relationship', severity: 'error',
        message: `Provider ${p.fullName} (${p.providerId}) is not linked to any clinic.`,
        collectionSlug: 'providers', documentId: p.providerId,
      })
    }
    if (!p.profilePhotoUrl) {
      alerts.push({
        alertKey: `scan-provider-nophoto-${p.providerId}`,
        type: 'missing_trust_field', severity: 'info',
        message: `Provider ${p.fullName} (${p.providerId}) has no profile photo.`,
        collectionSlug: 'providers', documentId: p.providerId,
      })
    }
    if (p.phoneDirect && !normalizePhone(String(p.phoneDirect)).valid) {
      alerts.push({
        alertKey: `scan-provider-phone-${p.providerId}`,
        type: 'invalid_phone', severity: 'info',
        message: `Provider ${p.fullName} (${p.providerId}) has a non-standard phone "${p.phoneDirect}".`,
        collectionSlug: 'providers', documentId: p.providerId,
      })
    }
  }

  // Promotion health: expiry, scope, image, and provider links.
  const now = Date.now()
  const providerById: Record<string, any> = {}
  for (const p of providers.docs as any[]) providerById[String(p.id)] = p
  for (const promo of promotions.docs as any[]) {
    if (!promo.active) continue
    const placement: string = promo.placement ?? 'sponsored-card'
    const promoLabel = promo.notes ?? promo.id

    if (promo.endDate && new Date(promo.endDate).getTime() < now) {
      alerts.push({
        alertKey: `scan-expired-promo-${promo.id}`,
        type: 'promo_expired', severity: 'warning',
        message: `Promotion "${promoLabel}" expired on ${String(promo.endDate).slice(0, 10)} but was still active. Auto-deactivated.`,
        collectionSlug: 'promotions', documentId: String(promo.id),
      })
      try {
        await payload.update({ collection: 'promotions', id: promo.id, data: { active: false }, overrideAccess: true })
      } catch {
        /* non-fatal */
      }
      continue
    }

    const scopeType: string = promo.scopeType
    const needsTreatment = ['treatment', 'treatment+state', 'treatment+city'].includes(scopeType)
    const needsLocation = ['state', 'city', 'treatment+state', 'treatment+city'].includes(scopeType)
    const needsBodyArea = scopeType === 'body-area'
    if (
      (needsTreatment && !promo.treatmentScope) ||
      (needsLocation && !promo.locationScope) ||
      (needsBodyArea && !promo.bodyAreaScope)
    ) {
      alerts.push({
        alertKey: `scan-promo-scope-${promo.id}`,
        type: 'promo_scope_mismatch', severity: 'warning',
        message: `Active promotion "${promoLabel}" has scope "${scopeType}" but is missing its required scope target (treatment / location / body area).`,
        collectionSlug: 'promotions', documentId: String(promo.id),
      })
    }

    if (placement === 'banner') {
      if (!promo.bannerImageUrl) {
        alerts.push({
          alertKey: `scan-banner-noimage-${promo.id}`,
          type: 'promo_missing_image', severity: 'warning',
          message: `Active ad banner "${promoLabel}" has no banner image; it falls back to a text-only block.`,
          collectionSlug: 'promotions', documentId: String(promo.id),
        })
      }
      continue
    }

    const provId = typeof promo.provider === 'object' ? promo.provider?.id : promo.provider
    if (!provId) {
      alerts.push({
        alertKey: `scan-promo-noprovider-${promo.id}`,
        type: 'promo_missing_provider', severity: 'error',
        message: `Active ${placement} "${promoLabel}" has no provider set; it cannot render. A paid slot may be unfulfilled.`,
        collectionSlug: 'promotions', documentId: String(promo.id),
      })
    } else if (!providerById[String(provId)]) {
      alerts.push({
        alertKey: `scan-orphan-promo-${promo.id}`,
        type: 'orphaned_promotion', severity: 'error',
        message: `Active ${placement} promotion "${promoLabel}" points at a provider that no longer exists. A paid slot may be unfulfilled.`,
        collectionSlug: 'promotions', documentId: String(promo.id), relatedId: String(provId),
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
      providers: providers.totalDocs,
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
