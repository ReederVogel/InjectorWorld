import { getPayloadInstance } from './payload-server'
import { byMeritDesc } from './merit'
import type { DirectoryProvider, DirectoryClinic } from './location-queries'

// Pragmatic v1 search: load the directory and filter in memory by treatment +
// location text. This is intentionally simple. Real server-side search
// (Postgres full-text + PostGIS radius + geocoding) is ROADMAP Phase 5.

export type SearchResult = {
  providers: DirectoryProvider[]
  clinics: DirectoryClinic[]
  treatmentLabel?: string
  locationLabel?: string
}

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
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
          neighborhood: p.clinic.neighborhood ?? undefined,
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
    licenseVerificationUrl: p.licenseVerificationUrl ?? undefined,
    acceptsNewPatients: !!p.acceptsNewPatients,
    offersVirtualConsult: !!p.offersVirtualConsult,
    languages: Array.isArray(p.languages) ? p.languages : [],
    loyaltyPrograms: Array.isArray(p.loyaltyPrograms) ? p.loyaltyPrograms : [],
    bio: p.bio ?? undefined,
    updatedAt: p.updatedAt ?? undefined,
    clinic,
  }
}

export async function searchDirectory({
  treatment,
  location,
}: {
  treatment?: string
  location?: string
}): Promise<SearchResult> {
  const payload = await getPayloadInstance()
  const treatmentQ = (treatment ?? '').trim()
  const locationQ = (location ?? '').trim()

  // Resolve the treatment to a canonical name (slug or name match).
  let treatmentLabel: string | undefined
  if (treatmentQ) {
    const tr = await payload.find({
      collection: 'treatments',
      where: { or: [{ slug: { equals: slugify(treatmentQ) } }, { name: { like: treatmentQ } }] },
      limit: 1,
      depth: 0,
    })
    treatmentLabel = (tr.docs[0] as any)?.name
  }

  // Build a state full-name -> code map so "California" matches clinics with state "CA".
  const statesRes = await payload.find({
    collection: 'locations',
    where: { kind: { equals: 'state' } },
    limit: 100,
    depth: 0,
  })
  const stateNameToCode = new Map<string, string>()
  let locationLabel: string | undefined
  for (const s of statesRes.docs as any[]) {
    if (s.name && s.state) stateNameToCode.set(String(s.name).toLowerCase(), s.state)
  }
  if (locationQ) {
    const code = stateNameToCode.get(locationQ.toLowerCase())
    const matchState = (statesRes.docs as any[]).find((s) => s.state === code)
    locationLabel = matchState?.name ?? locationQ
  }

  const tokens = locationQ
    .toLowerCase()
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

  function locMatches(city: string, state: string): boolean {
    if (!locationQ) return true
    const hay = `${city ?? ''} ${state ?? ''}`.toLowerCase()
    if (hay.includes(locationQ.toLowerCase())) return true
    const code = stateNameToCode.get(locationQ.toLowerCase())
    if (code && state === code) return true
    return tokens.every((t) => hay.includes(t) || stateNameToCode.get(t) === state)
  }

  function treatmentMatches(treatments: string[]): boolean {
    if (!treatmentQ) return true
    const needle = (treatmentLabel ?? treatmentQ).toLowerCase()
    return treatments.some((t) => t.toLowerCase().includes(needle) || needle.includes(t.toLowerCase()))
  }

  const [providersRes, clinicsRes] = await Promise.all([
    payload.find({ collection: 'providers', limit: 500, depth: 2 }),
    payload.find({ collection: 'clinics', limit: 500, depth: 0 }),
  ])

  const providers = (providersRes.docs as any[])
    .filter((p) => p.clinic && typeof p.clinic === 'object')
    .map(mapProvider)
    .filter((p) => treatmentMatches(p.treatments) && locMatches(p.clinic.city, p.clinic.state))
    .sort(byMeritDesc)

  // Clinics matched providers, for the clinic provider-count + treatment scoping.
  const providerCountByClinic = new Map<string, number>()
  for (const p of providers) {
    if (!p.clinic.id) continue
    providerCountByClinic.set(p.clinic.id, (providerCountByClinic.get(p.clinic.id) ?? 0) + 1)
  }

  const clinics: DirectoryClinic[] = (clinicsRes.docs as any[])
    .filter((c) => locMatches(c.city, c.state))
    // When a treatment is specified, only show clinics that have a matched provider.
    .filter((c) => !treatmentQ || providerCountByClinic.has(String(c.id)))
    .map((c) => ({
      id: String(c.id),
      slug: c.slug,
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
      providerCount: providerCountByClinic.get(String(c.id)) ?? 0,
    }))
    .sort((a, b) => (b.aggregateRatingCount ?? 0) - (a.aggregateRatingCount ?? 0))

  return { providers, clinics, treatmentLabel, locationLabel }
}
