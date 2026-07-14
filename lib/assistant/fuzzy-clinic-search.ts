import type { Payload } from 'payload'
import { getLocationSlugMap, lookupSlugs } from '../location-slug-lookup'
import type { DirectoryClinic } from '../location-queries'

// Isolated fallback for the AI assistant only: when a clinic/service NAME search
// (lib/search-queries.ts's tsquery prefix match, shared by manual search too)
// returns zero results, a misspelling is the most common reason. This does a
// separate trigram-similarity lookup (pg_trgm) against clinic_name and is only
// ever called after the normal search already came back empty, so it changes
// nothing about how the manual search bar or the search page behave.

const MIN_SIMILARITY = 0.3

export async function fuzzyClinicNameSearch(payload: Payload, name: string, limit = 6): Promise<DirectoryClinic[]> {
  const trimmed = name.trim()
  if (!trimmed) return []

  const pool = (payload.db as any).pool

  let candidates: { id: number; sim: number }[] = []
  try {
    const res = await pool.query(
      `SELECT id, similarity(clinic_name, $1) AS sim
         FROM clinics
        WHERE status = 'published' AND clinic_name % $1
        ORDER BY sim DESC
        LIMIT $2`,
      [trimmed, limit],
    )
    candidates = res.rows
      .map((r: any) => ({ id: Number(r.id), sim: Number(r.sim) }))
      .filter((r: { sim: number }) => r.sim >= MIN_SIMILARITY)
  } catch {
    // pg_trgm unavailable or query failed -- treat as no fuzzy match, never throw.
    return []
  }

  if (candidates.length === 0) return []

  const order = new Map(candidates.map((c, i) => [c.id, i]))
  const [slugMap, clinicsRes] = await Promise.all([
    getLocationSlugMap(),
    payload.find({
      collection: 'clinics',
      where: { id: { in: candidates.map((c) => c.id) } },
      limit,
      depth: 0,
      overrideAccess: true,
    }),
  ])

  const docs = (clinicsRes.docs as any[]).sort(
    (a, b) => (order.get(Number(a.id)) ?? 0) - (order.get(Number(b.id)) ?? 0),
  )

  return docs.map((c): DirectoryClinic => {
    const { citySlug, stateSlug } = lookupSlugs(c.city ?? '', c.state ?? '', slugMap)
    return {
      id: String(c.id),
      slug: c.slug,
      citySlug,
      stateSlug,
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
    }
  })
}
