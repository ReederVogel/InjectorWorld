import { getPayloadInstance } from './payload-server'

export type ResolvedRoute =
  | { type: 'treatment-pillar'; treatmentSlug: string }
  | { type: 'state-hub'; stateSlug: string }
  | { type: 'city-hub'; citySlug: string }
  | { type: 'treatment-state'; treatmentSlug: string; stateSlug: string }
  | { type: 'city-directory'; treatmentSlug: string; citySlug: string }
  | { type: 'neighborhood'; treatmentSlug: string; citySlug: string; neighborhoodSlug: string }
  | { type: 'not-found' }

type LocationEntry = {
  id: string
  kind: string
  name: string
  stateCode: string
  parentSlug?: string
}

// Module-level caches — warm once per Node process per worker.
let treatmentSet: Set<string> | null = null
let locationMap: Map<string, LocationEntry> | null = null

async function ensureCaches() {
  const payload = await getPayloadInstance()

  if (!treatmentSet) {
    const res = await payload.find({ collection: 'treatments', limit: 500, depth: 0 })
    treatmentSet = new Set(res.docs.map((t: any) => t.slug as string))
  }

  if (!locationMap) {
    const res = await payload.find({ collection: 'locations', limit: 5000, depth: 1 })
    locationMap = new Map()
    for (const loc of res.docs as any[]) {
      locationMap.set(loc.slug, {
        id: String(loc.id),
        kind: loc.kind,
        name: loc.name,
        stateCode: loc.state ?? '',
        parentSlug:
          loc.parent && typeof loc.parent === 'object' ? loc.parent.slug : undefined,
      })
    }
  }
}

export async function resolveRoute(segments: string[]): Promise<ResolvedRoute> {
  await ensureCaches()
  const ts = treatmentSet!
  const lm = locationMap!

  if (segments.length === 0) return { type: 'not-found' }

  if (segments.length === 1) {
    const [a] = segments
    if (ts.has(a)) return { type: 'treatment-pillar', treatmentSlug: a }
    const loc = lm.get(a)
    if (loc?.kind === 'state') return { type: 'state-hub', stateSlug: a }
    if (loc?.kind === 'metro' || loc?.kind === 'city')
      return { type: 'city-hub', citySlug: a }
    return { type: 'not-found' }
  }

  if (segments.length === 2) {
    const [a, b] = segments
    if (!ts.has(a)) return { type: 'not-found' }
    const loc = lm.get(b)
    if (!loc) return { type: 'not-found' }
    if (loc.kind === 'state') return { type: 'treatment-state', treatmentSlug: a, stateSlug: b }
    if (loc.kind === 'metro' || loc.kind === 'city')
      return { type: 'city-directory', treatmentSlug: a, citySlug: b }
    return { type: 'not-found' }
  }

  if (segments.length === 3) {
    const [a, b, c] = segments
    if (!ts.has(a)) return { type: 'not-found' }
    const city = lm.get(b)
    const hood = lm.get(c)
    if (
      (city?.kind === 'metro' || city?.kind === 'city') &&
      hood?.kind === 'neighborhood'
    ) {
      return { type: 'neighborhood', treatmentSlug: a, citySlug: b, neighborhoodSlug: c }
    }
    return { type: 'not-found' }
  }

  return { type: 'not-found' }
}

// For generateStaticParams — all single-segment and combined slugs.
export async function getAllRoutePaths(): Promise<string[][]> {
  const payload = await getPayloadInstance()
  const [treatRes, locRes] = await Promise.all([
    payload.find({ collection: 'treatments', limit: 500, depth: 0 }),
    payload.find({ collection: 'locations', limit: 5000, depth: 1 }),
  ])

  const treatSlugs: string[] = treatRes.docs.map((t: any) => t.slug)
  const stateSlugs: string[] = []
  const citySlugs: string[] = []
  const neighborhoods: { slug: string; citySlug: string }[] = []

  for (const loc of locRes.docs as any[]) {
    if (loc.kind === 'state') stateSlugs.push(loc.slug)
    else if (loc.kind === 'metro' || loc.kind === 'city') citySlugs.push(loc.slug)
    else if (loc.kind === 'neighborhood') {
      const parentSlug =
        loc.parent && typeof loc.parent === 'object' ? loc.parent.slug : null
      if (parentSlug) neighborhoods.push({ slug: loc.slug, citySlug: parentSlug })
    }
  }

  const paths: string[][] = []

  // 1-segment
  treatSlugs.forEach((t) => paths.push([t]))
  stateSlugs.forEach((s) => paths.push([s]))
  citySlugs.forEach((c) => paths.push([c]))

  // 2-segment: treatment + state/city
  for (const t of treatSlugs) {
    for (const s of stateSlugs) paths.push([t, s])
    for (const c of citySlugs) paths.push([t, c])
  }

  // 3-segment: treatment + city + neighborhood
  for (const t of treatSlugs) {
    for (const n of neighborhoods) {
      paths.push([t, n.citySlug, n.slug])
    }
  }

  return paths
}
