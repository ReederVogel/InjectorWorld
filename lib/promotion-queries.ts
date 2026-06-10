import { getPayloadInstance } from './payload-server'
import type { DirectoryProvider } from './location-queries'

export type SponsoredProvider = DirectoryProvider & { sponsoredRank: number }

/** Shape returned by getActiveBanner. */
export type ActiveBanner = {
  id: string
  advertiserName?: string
  bannerImageUrl?: string
  bannerLinkUrl?: string
  bannerAltText?: string
}

function mapProvider(p: any): DirectoryProvider {
  const clinic =
    p.clinic && typeof p.clinic === 'object'
      ? {
          id: String(p.clinic.id),
          name: p.clinic.clinicName,
          slug: p.clinic.slug,
          city: p.clinic.city,
          state: p.clinic.state,
          neighborhood: p.clinic.neighborhood,
          latitude: Number(p.clinic.latitude) || 0,
          longitude: Number(p.clinic.longitude) || 0,
        }
      : { id: '', name: '', slug: '', city: '', state: '', latitude: 0, longitude: 0 }

  return {
    id: String(p.id),
    slug: p.slug,
    fullName: p.fullName,
    credentials: p.credentials,
    title: p.title,
    profilePhotoUrl: p.profilePhotoUrl ?? undefined,
    aggregateRating: p.aggregateRating ?? undefined,
    aggregateRatingCount: p.aggregateRatingCount ?? undefined,
    startingPrice: p.startingPrice ?? undefined,
    treatments: Array.isArray(p.treatmentsOffered)
      ? p.treatmentsOffered.map((t: any) => (typeof t === 'object' ? t.name : '')).filter(Boolean)
      : [],
    editorsPick: !!p.editorsPick,
    licenseStateCode: p.licenseState ?? '',
    licenseNumber: p.licenseNumber ?? '',
    acceptsNewPatients: !!p.acceptsNewPatients,
    offersVirtualConsult: !!p.offersVirtualConsult,
    languages: Array.isArray(p.languages) ? p.languages : [],
    loyaltyPrograms: Array.isArray(p.loyaltyPrograms) ? p.loyaltyPrograms : [],
    bio: p.bio ?? undefined,
    updatedAt: p.updatedAt ?? undefined,
    additionalLocationCount: Array.isArray(p.additionalClinics) ? p.additionalClinics.length : 0,
    clinic,
  }
}

/** Builds the shared scope where-clause used across all three placement queries. */
function buildScopeWhere(
  scopeType: string,
  treatmentId?: string,
  locationId?: string,
): any {
  const now = new Date().toISOString()
  const conditions: any[] = [
    { scopeType: { equals: scopeType } },
    { active: { equals: true } },
    { or: [{ endDate: { greater_than: now } }, { endDate: { exists: false } }] },
  ]
  if (treatmentId) conditions.push({ treatmentScope: { equals: treatmentId } })
  if (locationId) conditions.push({ locationScope: { equals: locationId } })
  return { and: conditions }
}

// ─── Sponsored cards ──────────────────────────────────────────────────────────

/**
 * Returns sponsored-card promotions for a scope, sorted by rank.
 * This is the existing behaviour, now filtered to placement='sponsored-card'.
 */
export async function getPromotions(
  scopeType: string,
  treatmentId?: string,
  locationId?: string,
): Promise<SponsoredProvider[]> {
  const payload = await getPayloadInstance()

  const where = buildScopeWhere(scopeType, treatmentId, locationId)
  where.and.push({ placement: { equals: 'sponsored-card' } })

  const res = await payload.find({
    collection: 'promotions',
    where,
    limit: 3,
    sort: 'rank',
    depth: 3,
  })

  return res.docs
    .map((promo: any) => {
      const provider = promo.provider && typeof promo.provider === 'object' ? promo.provider : null
      if (!provider || !provider.clinic || typeof provider.clinic !== 'object') return null
      return { ...mapProvider(provider), sponsoredRank: promo.rank }
    })
    .filter(Boolean) as SponsoredProvider[]
}

// ─── Ad banner ────────────────────────────────────────────────────────────────

/**
 * Returns the active ad banner for a scope, or null if none exists.
 * At most one banner can be active per scope (enforced by the slot-guard hook).
 */
export async function getActiveBanner(
  scopeType: string,
  treatmentId?: string,
  locationId?: string,
): Promise<ActiveBanner | null> {
  const payload = await getPayloadInstance()

  const where = buildScopeWhere(scopeType, treatmentId, locationId)
  where.and.push({ placement: { equals: 'banner' } })

  const res = await payload.find({
    collection: 'promotions',
    where,
    limit: 1,
    depth: 0,
  })

  const doc = res.docs[0] as any
  if (!doc) return null

  return {
    id: String(doc.id),
    advertiserName: doc.advertiserName ?? undefined,
    bannerImageUrl: doc.bannerImageUrl ?? undefined,
    bannerLinkUrl: doc.bannerLinkUrl ?? undefined,
    bannerAltText: doc.bannerAltText ?? undefined,
  }
}

// ─── Organic pins ─────────────────────────────────────────────────────────────

/**
 * Returns a Map of provider id -> rank for organic-pin promotions in a scope.
 * Used by applyMeritOrder in lib/merit.ts to hoist pinned providers to the top
 * of the organic list.
 */
export async function getOrganicPins(
  scopeType: string,
  treatmentId?: string,
  locationId?: string,
): Promise<Map<string, number>> {
  const payload = await getPayloadInstance()

  const where = buildScopeWhere(scopeType, treatmentId, locationId)
  where.and.push({ placement: { equals: 'organic-pin' } })

  const res = await payload.find({
    collection: 'promotions',
    where,
    limit: 3,
    sort: 'rank',
    depth: 1,
  })

  const pinMap = new Map<string, number>()
  for (const promo of res.docs as any[]) {
    const provId =
      promo.provider && typeof promo.provider === 'object'
        ? String(promo.provider.id)
        : promo.provider
          ? String(promo.provider)
          : null
    if (provId) pinMap.set(provId, promo.rank ?? 1)
  }
  return pinMap
}
