/**
 * Standalone data-integrity scan. Re-checks the whole database and upserts
 * DataAlerts. Run on a schedule (DO cron / Payload jobs) or manually:
 *
 *   npx tsx --env-file=.env.local scripts/scan-data-alerts.ts
 *
 * Detects: duplicate clinics (googlePlaceId), duplicate providers
 * (name+state+license), providers without a clinic, clinics whose city has no
 * metro Location, published providers missing a photo, and promotions pointing
 * at a missing/inactive provider (oversold / orphaned slots).
 */
import { getPayload } from 'payload'
import config from '../payload.config'
import { upsertAlert, reconcileAlerts, type AlertInput } from '../lib/import/import-data'
import { normalizeCity } from '../lib/import/helpers'

async function main() {
  const payload = await getPayload({ config })
  const alerts: AlertInput[] = []

  const [clinics, providers, promotions, metros] = await Promise.all([
    payload.find({ collection: 'clinics', limit: 100000, depth: 0 }),
    payload.find({ collection: 'providers', limit: 100000, depth: 0 }),
    payload.find({ collection: 'promotions', limit: 100000, depth: 0 }),
    payload.find({ collection: 'locations', where: { kind: { equals: 'metro' } } as any, limit: 1000, depth: 0 }),
  ])

  const metroCities = new Set<string>()
  for (const m of metros.docs as any[]) if (m.name && m.state) metroCities.add(`${normalizeCity(m.name)}|${m.state}`)

  // Duplicate clinics by googlePlaceId
  const placeSeen: Record<string, string> = {}
  for (const c of clinics.docs as any[]) {
    if (!c.googlePlaceId) continue
    if (placeSeen[c.googlePlaceId]) {
      alerts.push({
        alertKey: `scan-dup-clinic-${c.googlePlaceId}`,
        type: 'duplicate_clinic', severity: 'warning',
        message: `Clinics ${placeSeen[c.googlePlaceId]} and ${c.clinicId} share google_place_id ${c.googlePlaceId}.`,
        collectionSlug: 'clinics', documentId: c.clinicId, relatedId: placeSeen[c.googlePlaceId],
      })
    } else placeSeen[c.googlePlaceId] = c.clinicId

    // City match
    if (c.city && c.state && !metroCities.has(`${normalizeCity(c.city)}|${c.state}`)) {
      alerts.push({
        alertKey: `scan-clinic-city-${c.clinicId}`,
        type: 'unmatched_city', severity: 'info',
        message: `Clinic ${c.clinicName} is in ${c.city}, ${c.state} with no metro Location; not shown on any city page.`,
        collectionSlug: 'clinics', documentId: c.clinicId,
      })
    }
  }

  // Duplicate providers + missing clinic + missing photo
  const licSeen: Record<string, string> = {}
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
  }

  // Orphaned / oversold promotions: provider missing or implies inactive
  const providerById: Record<string, any> = {}
  for (const p of providers.docs as any[]) providerById[String(p.id)] = p
  for (const promo of promotions.docs as any[]) {
    if (!promo.active) continue
    const provId = typeof promo.provider === 'object' ? promo.provider?.id : promo.provider
    if (!provId || !providerById[String(provId)]) {
      alerts.push({
        alertKey: `scan-orphan-promo-${promo.id}`,
        type: 'orphaned_promotion', severity: 'error',
        message: `Active promotion "${promo.notes ?? promo.id}" points at a provider that no longer exists. A paid slot may be unfulfilled.`,
        collectionSlug: 'promotions', documentId: String(promo.id), relatedId: provId ? String(provId) : undefined,
      })
    }
  }

  for (const a of alerts) await upsertAlert(payload, a, 'scan')
  await reconcileAlerts(payload, 'scan', new Set(alerts.map((a) => a.alertKey)))

  console.log(`\n===== data-alerts scan =====`)
  console.log(`Scanned ${clinics.totalDocs} clinics, ${providers.totalDocs} providers, ${promotions.totalDocs} promotions.`)
  console.log(`Alerts upserted: ${alerts.length}`)
  const bySeverity = alerts.reduce<Record<string, number>>((acc, a) => { acc[a.severity] = (acc[a.severity] ?? 0) + 1; return acc }, {})
  console.log('  by severity:', bySeverity)
  console.log(`See /admin → System → Data Alerts.\n`)
  process.exit(0)
}

main().catch((err) => { console.error(err); process.exit(1) })
