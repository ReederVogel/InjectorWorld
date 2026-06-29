import { getPayloadInstance } from './payload-server'
import type { DirectoryProvider, DirectoryClinic } from './location-queries'
import { getLocationSlugMap, lookupSlugs } from './location-slug-lookup'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActiveBanner = {
  id: string
  bannerImageUrl?: string
  bannerLinkUrl?: string
  bannerAltText?: string
}

export type SponsoredProvider = DirectoryProvider & { sponsoredRank: number }
export type SponsoredClinic = DirectoryClinic & { sponsoredRank: number }

export type PromotionCoverageMap = {
  treatment: Record<string, Record<string, number>>
  find: Record<string, Record<string, number>>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildWhere(
  scope: string,
  treatmentId?: string,
  stateId?: string,
  cityId?: string,
): any {
  const now = new Date().toISOString()
  const conds: any[] = [
    { scope: { equals: scope } },
    { status: { equals: 'active' } },
    { or: [{ endDate: { greater_than: now } }, { endDate: { exists: false } }] },
  ]
  if (treatmentId) conds.push({ treatment: { equals: treatmentId } })
  if (stateId) conds.push({ state: { equals: stateId } })
  if (cityId) conds.push({ city: { equals: cityId } })
  return { and: conds }
}

function mapClinic(
  c: any,
  slugMap: Map<string, { citySlug: string; stateSlug: string }>,
): DirectoryClinic {
  const slugs = lookupSlugs(c.city ?? '', c.state ?? '', slugMap)
  return {
    id: String(c.id),
    slug: c.slug,
    citySlug: slugs.citySlug,
    stateSlug: slugs.stateSlug,
    clinicName: c.clinicName,
    tagline: c.tagline ?? undefined,
    city: c.city,
    state: c.state,
    neighborhood: c.neighborhood ?? undefined,
    aggregateRating: c.aggregateRating ?? undefined,
    aggregateRatingCount: c.aggregateRatingCount ?? undefined,
    photoUrl: c.clinicPhotoUrls?.[0]?.url ?? undefined,
    serviceType: c.serviceType || 'In-Person',
    yearEstablished: c.yearEstablished ?? undefined,
    latitude: Number(c.latitude) || 0,
    longitude: Number(c.longitude) || 0,
    providerCount: 0,
    clinicType: c.clinicType ?? undefined,
    startingPrice: c.startingPrice ?? undefined,
  }
}

// ─── Public query functions ───────────────────────────────────────────────────

export async function getActiveBanner(
  scope: string,
  treatmentId?: string,
  stateId?: string,
  cityId?: string,
): Promise<ActiveBanner | null> {
  const payload = await getPayloadInstance()
  const where = buildWhere(scope, treatmentId, stateId, cityId)
  ;(where.and as any[]).push({ placement: { equals: 'banner' } })

  const res = await payload.find({ collection: 'promotions', where, limit: 1, depth: 1 })
  const doc = res.docs[0] as any
  if (!doc) return null

  return {
    id: String(doc.id),
    bannerImageUrl:
      doc.bannerImage && typeof doc.bannerImage === 'object'
        ? (doc.bannerImage.url as string | undefined)
        : undefined,
    bannerLinkUrl: doc.bannerLinkUrl ?? undefined,
    bannerAltText: doc.bannerAltText ?? undefined,
  }
}

export async function getSponsoredClinics(
  scope: string,
  treatmentId?: string,
  stateId?: string,
  cityId?: string,
): Promise<SponsoredClinic[]> {
  const payload = await getPayloadInstance()
  const where = buildWhere(scope, treatmentId, stateId, cityId)
  ;(where.and as any[]).push({ placement: { equals: 'sponsored-card' } })
  ;(where.and as any[]).push({ clinic: { exists: true } })

  const [slugMap, res] = await Promise.all([
    getLocationSlugMap(),
    payload.find({ collection: 'promotions', where, limit: 3, sort: 'featuredRank', depth: 3 }),
  ])

  return res.docs
    .map((promo: any) => {
      const c = promo.clinic && typeof promo.clinic === 'object' ? promo.clinic : null
      if (!c) return null
      return { ...mapClinic(c, slugMap), sponsoredRank: promo.featuredRank ?? 1 }
    })
    .filter(Boolean) as SponsoredClinic[]
}

export async function getFeaturedProviderPins(
  scope: string,
  treatmentId?: string,
  stateId?: string,
  cityId?: string,
): Promise<Map<string, number>> {
  const payload = await getPayloadInstance()
  const where = buildWhere(scope, treatmentId, stateId, cityId)
  ;(where.and as any[]).push({ placement: { equals: 'featured-pin' } })
  ;(where.and as any[]).push({ provider: { exists: true } })

  const res = await payload.find({ collection: 'promotions', where, limit: 3, sort: 'featuredRank', depth: 1 })
  const pinMap = new Map<string, number>()
  for (const promo of res.docs as any[]) {
    const provId =
      promo.provider && typeof promo.provider === 'object'
        ? String(promo.provider.id)
        : promo.provider
          ? String(promo.provider)
          : null
    if (provId) pinMap.set(provId, promo.featuredRank ?? 1)
  }
  return pinMap
}

export async function getFeaturedClinicPins(
  scope: string,
  treatmentId?: string,
  stateId?: string,
  cityId?: string,
): Promise<Map<string, number>> {
  const payload = await getPayloadInstance()
  const where = buildWhere(scope, treatmentId, stateId, cityId)
  ;(where.and as any[]).push({ placement: { equals: 'featured-pin' } })
  ;(where.and as any[]).push({ clinic: { exists: true } })

  const res = await payload.find({ collection: 'promotions', where, limit: 3, sort: 'featuredRank', depth: 1 })
  const pinMap = new Map<string, number>()
  for (const promo of res.docs as any[]) {
    const clinicId =
      promo.clinic && typeof promo.clinic === 'object'
        ? String(promo.clinic.id)
        : promo.clinic
          ? String(promo.clinic)
          : null
    if (clinicId) pinMap.set(clinicId, promo.featuredRank ?? 1)
  }
  return pinMap
}

export async function getPromotionCoverage(): Promise<PromotionCoverageMap> {
  const payload = await getPayloadInstance()
  const now = new Date().toISOString()
  const res = await payload.find({
    collection: 'promotions',
    where: {
      and: [
        { status: { equals: 'active' } },
        { or: [{ endDate: { greater_than: now } }, { endDate: { exists: false } }] },
      ],
    },
    limit: 200,
    depth: 0,
  })

  const treatment: Record<string, Record<string, number>> = {}
  const find: Record<string, Record<string, number>> = {}

  for (const doc of res.docs as any[]) {
    const scope = doc.scope as string
    const placement = doc.placement as string
    if (!scope || !placement) continue

    if (scope.startsWith('treatment')) {
      const key = doc.treatment ? String(doc.treatment) : '_all'
      if (!treatment[key]) treatment[key] = {}
      treatment[key][placement] = (treatment[key][placement] ?? 0) + 1
    } else {
      const key = doc.city
        ? String(doc.city)
        : doc.state
          ? String(doc.state)
          : '_national'
      if (!find[key]) find[key] = {}
      find[key][placement] = (find[key][placement] ?? 0) + 1
    }
  }

  return { treatment, find }
}
