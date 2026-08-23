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
  service: Record<string, Record<string, number>>
  find: Record<string, Record<string, number>>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildWhere(
  scope: string,
  serviceId?: string,
  stateId?: string,
  cityId?: string,
): any {
  const now = new Date().toISOString()
  const conds: any[] = [
    { scope: { equals: scope } },
    { status: { equals: 'active' } },
    { or: [{ endDate: { greater_than: now } }, { endDate: { exists: false } }] },
  ]
  if (serviceId) conds.push({ service: { equals: serviceId } })
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
    latitude: Number(c.latitude) || 0,
    longitude: Number(c.longitude) || 0,
    providerCount: 0,
    clinicType: c.clinicType ?? undefined,
    startingPrice: c.startingPrice ?? undefined,
  }
}

// ─── Public query functions ───────────────────────────────────────────────────

const EARTH_RADIUS_MILES = 3958.8

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * ZIP-radius promotion matching. Visitor coordinates come from IP geolocation
 * (small dataset -- at most a few active zip-scoped banners at once -- so
 * distance is computed in JS rather than a PostGIS query). Only the "banner"
 * placement is wired up; see the beforeChange guard in collections/Promotions.ts.
 */
export async function getZipScopedBanner(
  lat: number,
  lng: number,
  serviceId?: string,
): Promise<ActiveBanner | null> {
  const payload = await getPayloadInstance()
  const now = new Date().toISOString()

  const scopeConds: any[] = [{ scope: { equals: 'zip' } }]
  if (serviceId) {
    scopeConds.push({ and: [{ scope: { equals: 'service+zip' } }, { service: { equals: serviceId } }] })
  }

  const res = await payload.find({
    collection: 'promotions',
    where: {
      and: [
        { status: { equals: 'active' } },
        { placement: { equals: 'banner' } },
        { or: [{ endDate: { greater_than: now } }, { endDate: { exists: false } }] },
        { or: scopeConds },
      ],
    } as any,
    limit: 20,
    depth: 2,
  })

  let best: { doc: any; distance: number } | null = null
  for (const doc of res.docs as any[]) {
    const zip = doc.zipScope
    const radius = Number(doc.zipRadiusMiles)
    if (!zip || typeof zip !== 'object' || !Number.isFinite(radius)) continue
    const zLat = Number(zip.lat)
    const zLng = Number(zip.lng)
    if (!Number.isFinite(zLat) || !Number.isFinite(zLng)) continue
    const distance = haversineMiles(lat, lng, zLat, zLng)
    if (distance > radius) continue
    if (!best || distance < best.distance) best = { doc, distance }
  }
  if (!best) return null

  const doc = best.doc
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

export async function getActiveBanner(
  scope: string,
  serviceId?: string,
  stateId?: string,
  cityId?: string,
): Promise<ActiveBanner | null> {
  const payload = await getPayloadInstance()
  const where = buildWhere(scope, serviceId, stateId, cityId)
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
  serviceId?: string,
  stateId?: string,
  cityId?: string,
): Promise<SponsoredClinic[]> {
  const payload = await getPayloadInstance()
  const where = buildWhere(scope, serviceId, stateId, cityId)
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
  serviceId?: string,
  stateId?: string,
  cityId?: string,
): Promise<Map<string, number>> {
  const payload = await getPayloadInstance()
  const where = buildWhere(scope, serviceId, stateId, cityId)
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
  serviceId?: string,
  stateId?: string,
  cityId?: string,
): Promise<Map<string, number>> {
  const payload = await getPayloadInstance()
  const where = buildWhere(scope, serviceId, stateId, cityId)
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

  const service: Record<string, Record<string, number>> = {}
  const find: Record<string, Record<string, number>> = {}

  for (const doc of res.docs as any[]) {
    const scope = doc.scope as string
    const placement = doc.placement as string
    if (!scope || !placement) continue

    if (scope.startsWith('service')) {
      const key = doc.service ? String(doc.service) : '_all'
      if (!service[key]) service[key] = {}
      service[key][placement] = (service[key][placement] ?? 0) + 1
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

  return { service, find }
}
