import { getPayloadInstance } from './payload-server'
import { getLocationSlugMap, lookupSlugs } from './location-slug-lookup'
import { num } from './lean-clinic-listing'

export type HeroClinic = {
  id: string
  clinicName: string
  slug: string
  citySlug: string
  stateSlug: string
  city: string
  state: string
  neighborhood?: string
  aggregateRating?: number
  aggregateRatingCount?: number
  latitude?: number
  longitude?: number
  clinicPhotoUrls?: string[]
}

export type HeroTreatment = {
  id: string
  name: string
  slug: string
  category: string
}

export type HeroLocation = {
  id: string
  name: string
  slug: string
  kind: string
  state?: string
  latitude?: number
  longitude?: number
}

export type HeroProviderCard = {
  id: string
  providerId: string
  fullName: string
  slug: string
  credentials: string
  title: string
  profilePhotoUrl?: string
  aggregateRating?: number
  aggregateRatingCount?: number
  startingPrice?: number
  treatments: string[]
  editorsPick?: boolean
  licenseStateCode: string
  licenseNumber: string
  licenseVerificationUrl?: string
  licenseStatus?: string
  clinic: {
    id: string
    name: string
    slug: string
    citySlug: string
    stateSlug: string
    neighborhood?: string
    city: string
    state: string
    latitude: number
    longitude: number
    aggregateRating?: number
    aggregateRatingCount?: number
  }
}

// Raw SQL, not payload.find(): this used to be an unfiltered
// `payload.find({ collection: 'clinics', where: { status: 'published' },
// limit: 30, sort: '-aggregateRatingCount' })`. Payload/Drizzle always joins
// in every relationship/array field (brandsOffered, servicesOffered,
// languages, sourceUrls, etc.) regardless of `depth`, so that query touched
// and sorted the entire clinics table (29k+ rows after the 2026-07-28/29
// batch imports, each carrying far more relations than before) on every
// homepage load. Confirmed via DO runtime logs (repeated OOM-pattern crashes)
// and a Postgres temp-file spill on this exact query shape. Selecting only
// the columns HeroClinic actually uses, and limiting to top-30 BEFORE joining
// photo URLs, keeps this cheap regardless of table size (see also the
// clinics_status_rating_idx composite index in scripts/setup-search-indexes.ts).
async function getTopHeroClinics(pool: any): Promise<any[]> {
  const res = await pool.query(`
    WITH top_clinics AS (
      SELECT id, clinic_name, slug, city, state, neighborhood,
             aggregate_rating, aggregate_rating_count, latitude, longitude, created_at
        FROM clinics
       WHERE status = 'published'
       ORDER BY aggregate_rating_count DESC, created_at DESC
       LIMIT 30
    )
    SELECT tc.id, tc.clinic_name, tc.slug, tc.city, tc.state, tc.neighborhood,
           tc.aggregate_rating, tc.aggregate_rating_count, tc.latitude, tc.longitude,
           COALESCE(
             json_agg(cpu.url ORDER BY cpu._order) FILTER (WHERE cpu.url IS NOT NULL),
             '[]'
           ) AS clinic_photo_urls
      FROM top_clinics tc
      LEFT JOIN clinics_clinic_photo_urls cpu ON cpu._parent_id = tc.id
     GROUP BY tc.id, tc.clinic_name, tc.slug, tc.city, tc.state, tc.neighborhood,
              tc.aggregate_rating, tc.aggregate_rating_count, tc.latitude, tc.longitude,
              tc.aggregate_rating_count, tc.created_at
     ORDER BY tc.aggregate_rating_count DESC, tc.created_at DESC
  `)
  return res.rows
}

export async function getHeroData() {
  const payload = await getPayloadInstance()
  const slugMap = await getLocationSlugMap()
  const pool = (payload.db as any).pool

  const [treatmentsRes, locationsRes, providersRes, clinicsRows] = await Promise.all([
    payload.find({
      collection: 'services',
      limit: 100,
      depth: 0,
      sort: 'name',
    }),
    payload.find({
      collection: 'locations',
      limit: 200,
      depth: 0,
      where: { kind: { in: ['metro', 'neighborhood', 'state'] } },
      sort: '-featured',
    }),
    payload.find({
      collection: 'providers',
      where: { status: { equals: 'published' } },
      limit: 60,
      depth: 2,
      sort: 'featuredRank',
    }),
    // Direct clinic query so the hero clinics tab is not derived from provider results.
    // Previously, clinic cards in Hero search were built from the provider.clinic objects,
    // meaning a clinic with no providers in the top 60 would never surface.
    getTopHeroClinics(pool),
  ])

  const treatments: HeroTreatment[] = treatmentsRes.docs.map((t: any) => ({
    id: String(t.id),
    name: t.name,
    slug: t.slug,
    category: t.category,
  }))

  const locations: HeroLocation[] = locationsRes.docs.map((l: any) => ({
    id: String(l.id),
    name: l.name,
    slug: l.slug,
    kind: l.kind,
    state: l.state,
    latitude: l.latitude,
    longitude: l.longitude,
  }))

  const providers: HeroProviderCard[] = providersRes.docs
    .filter((p: any) => p.clinic && typeof p.clinic === 'object')
    .map((p: any) => ({
      id: String(p.id),
      providerId: p.providerId,
      fullName: p.fullName,
      slug: p.slug,
      credentials: p.credentials,
      title: p.title,
      profilePhotoUrl: p.profilePhotoUrl,
      aggregateRating: p.aggregateRating,
      aggregateRatingCount: p.aggregateRatingCount,
      startingPrice: p.startingPrice,
      treatments: Array.isArray(p.servicesOffered)
        ? p.servicesOffered.map((t: any) => (typeof t === 'object' ? t.name : ''))
        : [],
      editorsPick: !!p.editorsPick,
      licenseStateCode: p.licenseState,
      licenseNumber: p.licenseNumber,
      licenseVerificationUrl: p.licenseVerificationUrl ?? undefined,
      licenseStatus: p.licenseStatus ?? undefined,
      clinic: {
        id: String(p.clinic.id),
        name: p.clinic.clinicName,
        slug: p.clinic.slug,
        ...lookupSlugs(p.clinic.city ?? '', p.clinic.state ?? '', slugMap),
        neighborhood: p.clinic.neighborhood,
        city: p.clinic.city,
        state: p.clinic.state,
        latitude: Number(p.clinic.latitude),
        longitude: Number(p.clinic.longitude),
        aggregateRating: p.clinic.aggregateRating ?? undefined,
        aggregateRatingCount: p.clinic.aggregateRatingCount ?? undefined,
      },
    }))

  const clinics: HeroClinic[] = clinicsRows.map((c: any) => ({
    id: String(c.id),
    clinicName: c.clinic_name,
    slug: c.slug,
    ...lookupSlugs(c.city ?? '', c.state ?? '', slugMap),
    city: c.city,
    state: c.state,
    neighborhood: c.neighborhood ?? undefined,
    // pg returns numeric columns as strings; HeroClinic types these as numbers
    // and ClinicResultCard/HeroMap call .toFixed(1) on the rating.
    aggregateRating: num(c.aggregate_rating) ?? undefined,
    aggregateRatingCount: num(c.aggregate_rating_count) ?? undefined,
    latitude: num(c.latitude) ?? undefined,
    longitude: num(c.longitude) ?? undefined,
    clinicPhotoUrls: Array.isArray(c.clinic_photo_urls) ? c.clinic_photo_urls : undefined,
  }))

  return { treatments, locations, providers, clinics }
}

