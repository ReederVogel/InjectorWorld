import { getPayloadInstance } from './payload-server'
import type { DirectoryProvider } from './location-queries'

export type SponsoredProvider = DirectoryProvider & { sponsoredRank: number }

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
    clinic,
  }
}

export async function getPromotions(
  scopeType: string,
  treatmentId?: string,
  locationId?: string,
): Promise<SponsoredProvider[]> {
  const payload = await getPayloadInstance()
  const now = new Date().toISOString()

  const where: any = {
    and: [
      { scopeType: { equals: scopeType } },
      { active: { equals: true } },
      { or: [{ endDate: { greater_than: now } }, { endDate: { exists: false } }] },
    ],
  }
  if (treatmentId) where.and.push({ treatmentScope: { equals: treatmentId } })
  if (locationId) where.and.push({ locationScope: { equals: locationId } })

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
