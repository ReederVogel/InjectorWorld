import { getPayloadInstance } from './payload-server'

// ── Route types ───────────────────────────────────────────────────────────────
// Treatment path (SEO — indexed)
//   /[treatment]                     → treatment-pillar
//   /[treatment]/[state]             → treatment-state
//   /[treatment]/[state]/[city]      → city-directory  (money page)
//
// Find path (UX — indexed for live markets)
//   /[state]                         → state-hub
//   /[state]/[city]                  → city-hub
//   /[state]/[city]/[neighborhood]   → neighborhood-hub

export type ResolvedRoute =
  | { type: 'treatment-pillar'; treatmentSlug: string }
  | { type: 'state-hub'; stateSlug: string }
  | { type: 'treatment-state'; treatmentSlug: string; stateSlug: string }
  | { type: 'city-hub'; stateSlug: string; citySlug: string }
  | { type: 'city-directory'; treatmentSlug: string; stateSlug: string; citySlug: string }
  | { type: 'neighborhood-hub'; stateSlug: string; citySlug: string; neighborhoodSlug: string }
  | { type: 'not-found' }

type LocationEntry = {
  id: string
  kind: string
  name: string
  stateCode: string
  parentSlug?: string
}

// Module-level caches with 60 s TTL so new treatments/locations become
// routable without a server restart.
const CACHE_TTL_MS = 60_000
let treatmentSet: Set<string> | null = null
let locationMap: Map<string, LocationEntry> | null = null
let cachedAt = 0

async function ensureCaches() {
  const stale = Date.now() - cachedAt > CACHE_TTL_MS
  if (treatmentSet && locationMap && !stale) return

  const payload = await getPayloadInstance()

  const treatRes = await payload.find({ collection: 'treatments', limit: 500, depth: 0 })
  treatmentSet = new Set(treatRes.docs.map((t: any) => t.slug as string))

  const locRes = await payload.find({ collection: 'locations', limit: 5000, depth: 1 })
  const nextMap = new Map<string, LocationEntry>()
  for (const loc of locRes.docs as any[]) {
    nextMap.set(loc.slug, {
      id: String(loc.id),
      kind: loc.kind,
      name: loc.name,
      stateCode: loc.state ?? '',
      parentSlug:
        loc.parent && typeof loc.parent === 'object' ? loc.parent.slug : undefined,
    })
  }
  locationMap = nextMap
  cachedAt = Date.now()
}

export async function resolveRoute(segments: string[]): Promise<ResolvedRoute> {
  await ensureCaches()
  const ts = treatmentSet!
  const lm = locationMap!

  if (segments.length === 0) return { type: 'not-found' }

  // ── 1 segment ────────────────────────────────────────────────────────────────
  if (segments.length === 1) {
    const [a] = segments
    if (ts.has(a)) return { type: 'treatment-pillar', treatmentSlug: a }
    const loc = lm.get(a)
    if (loc?.kind === 'state') return { type: 'state-hub', stateSlug: a }
    return { type: 'not-found' }
  }

  // ── 2 segments ────────────────────────────────────────────────────────────────
  if (segments.length === 2) {
    const [a, b] = segments
    const aLoc = lm.get(a)

    if (ts.has(a)) {
      // treatment + state
      const bLoc = lm.get(b)
      if (bLoc?.kind === 'state') return { type: 'treatment-state', treatmentSlug: a, stateSlug: b }
      return { type: 'not-found' }
    }

    if (aLoc?.kind === 'state') {
      // state + city  →  city-hub (Find path)
      const bLoc = lm.get(b)
      if (bLoc?.kind === 'metro' || bLoc?.kind === 'city')
        return { type: 'city-hub', stateSlug: a, citySlug: b }
      return { type: 'not-found' }
    }

    return { type: 'not-found' }
  }

  // ── 3 segments ────────────────────────────────────────────────────────────────
  if (segments.length === 3) {
    const [a, b, c] = segments

    if (ts.has(a)) {
      // treatment + state + city  →  city-directory (money page)
      const bLoc = lm.get(b)
      const cLoc = lm.get(c)
      if (bLoc?.kind === 'state' && (cLoc?.kind === 'metro' || cLoc?.kind === 'city'))
        return { type: 'city-directory', treatmentSlug: a, stateSlug: b, citySlug: c }
      return { type: 'not-found' }
    }

    const aLoc = lm.get(a)
    if (aLoc?.kind === 'state') {
      // state + city + neighborhood  →  neighborhood-hub (Find path)
      const bLoc = lm.get(b)
      const cLoc = lm.get(c)
      if (
        (bLoc?.kind === 'metro' || bLoc?.kind === 'city') &&
        cLoc?.kind === 'neighborhood'
      )
        return { type: 'neighborhood-hub', stateSlug: a, citySlug: b, neighborhoodSlug: c }
      return { type: 'not-found' }
    }

    return { type: 'not-found' }
  }

  return { type: 'not-found' }
}

// getAllRoutePaths — used by generateStaticParams.
// Pre-renders only paths backed by real data; ISR handles the rest on first visit.
export async function getAllRoutePaths(): Promise<string[][]> {
  const payload = await getPayloadInstance()
  const [treatRes, locRes, clinicsRes] = await Promise.all([
    payload.find({ collection: 'treatments', limit: 500, depth: 0 }),
    payload.find({ collection: 'locations', limit: 5000, depth: 1 }),
    payload.find({
      collection: 'clinics',
      where: { status: { equals: 'published' } },
      limit: 2000,
      depth: 0,
    }),
  ])

  const treatSlugs: string[] = treatRes.docs.map((t: any) => t.slug)
  const stateSlugs: string[] = []
  // Map state code → state slug
  const stateCodeToSlug = new Map<string, string>()
  // city slug → state slug (for cross-linking)
  const citySlugToStateSlug = new Map<string, string>()

  const cityEntries: Array<{ citySlug: string; stateSlug: string }> = []
  const neighborhoods: Array<{ slug: string; citySlug: string; stateSlug: string }> = []

  // Map city "name,stateCode" → city slug
  const cityKeyToSlug = new Map<string, string>()

  for (const loc of locRes.docs as any[]) {
    if (loc.kind === 'state') {
      stateSlugs.push(loc.slug)
      if (loc.state) stateCodeToSlug.set((loc.state as string).toLowerCase(), loc.slug)
    } else if (loc.kind === 'metro' || loc.kind === 'city') {
      const key = `${(loc.name as string).toLowerCase().replace(/\s+city$/i, '').trim()},${(loc.state ?? '').toLowerCase()}`
      cityKeyToSlug.set(key, loc.slug)
    }
  }

  for (const loc of locRes.docs as any[]) {
    if (loc.kind === 'metro' || loc.kind === 'city') {
      const stateSlug = stateCodeToSlug.get((loc.state ?? '').toLowerCase()) ?? ''
      cityEntries.push({ citySlug: loc.slug, stateSlug })
      citySlugToStateSlug.set(loc.slug, stateSlug)
    } else if (loc.kind === 'neighborhood') {
      const parentSlug =
        loc.parent && typeof loc.parent === 'object' ? loc.parent.slug : null
      if (parentSlug) {
        const stateSlug = citySlugToStateSlug.get(parentSlug) ?? ''
        neighborhoods.push({ slug: loc.slug, citySlug: parentSlug, stateSlug })
      }
    }
  }

  // Determine which cities actually have clinics
  const activeCitySlugs = new Set<string>()
  const activeStateSlugs = new Set<string>()
  for (const clinic of clinicsRes.docs as any[]) {
    const key = `${(clinic.city ?? '').toLowerCase().replace(/\s+city$/i, '').trim()},${(clinic.state ?? '').toLowerCase()}`
    const citySlug = cityKeyToSlug.get(key)
    if (citySlug) {
      activeCitySlugs.add(citySlug)
      const stateSlug = citySlugToStateSlug.get(citySlug)
      if (stateSlug) activeStateSlugs.add(stateSlug)
    }
  }

  const paths: string[][] = []

  // 1-segment: all treatments + all states (no cities at 1-segment anymore)
  treatSlugs.forEach((t) => paths.push([t]))
  stateSlugs.forEach((s) => paths.push([s]))

  // 2-segment: active treatment+state combos + active state+city combos
  const activeCityEntries = cityEntries.filter((e) => activeCitySlugs.has(e.citySlug))

  for (const t of treatSlugs) {
    for (const s of activeStateSlugs) paths.push([t, s])
  }
  for (const { citySlug, stateSlug } of activeCityEntries) {
    if (stateSlug) paths.push([stateSlug, citySlug])
  }

  // 3-segment: treatment+state+city (money pages) + state+city+neighborhood
  for (const t of treatSlugs) {
    for (const { citySlug, stateSlug } of activeCityEntries) {
      if (stateSlug) paths.push([t, stateSlug, citySlug])
    }
  }
  const activeNeighborhoods = neighborhoods.filter((n) => activeCitySlugs.has(n.citySlug))
  for (const { slug, citySlug, stateSlug } of activeNeighborhoods) {
    if (stateSlug) paths.push([stateSlug, citySlug, slug])
  }

  return paths
}
