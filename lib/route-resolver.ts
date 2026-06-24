import { getPayloadInstance } from './payload-server'

// ── Route types ───────────────────────────────────────────────────────────────
// Services path (SEO — indexed). Everything lives under /services/*.
//   /services                                   → services-index (all services)
//   /services/[svc]                             → service-pillar
//   /services/[svc]/[state]                     → service-state
//   /services/[svc]/[state]/[city]              → service-city-directory (money page)
//   /services/[svc]/[state]/[city]/[hood]       → service-neighborhood
//
// Find path (UX — indexed for live markets)
//   /[state]                         → state-hub
//   /[state]/[city]                  → city-hub
//   /[state]/[city]/[neighborhood]   → neighborhood-hub
//
// Old top-level treatment URLs (/botox, /botox/texas, /botox/texas/houston)
// resolve to not-found — they 404 cleanly. No redirects.

export type ResolvedRoute =
  | { type: 'services-index' }
  | { type: 'service-pillar'; treatmentSlug: string }
  | { type: 'service-state'; treatmentSlug: string; stateSlug: string }
  | { type: 'service-city-directory'; treatmentSlug: string; stateSlug: string; citySlug: string }
  | { type: 'service-neighborhood'; treatmentSlug: string; stateSlug: string; citySlug: string; neighborhoodSlug: string }
  | { type: 'state-hub'; stateSlug: string }
  | { type: 'city-hub'; stateSlug: string; citySlug: string }
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

  // ── Services path (/services/*) ───────────────────────────────────────────────
  if (segments[0] === 'services') {
    const rest = segments.slice(1)

    // /services  →  flat index of all services
    if (rest.length === 0) return { type: 'services-index' }

    const [svc, state, city, hood] = rest

    // /services/[svc]  →  service pillar
    if (rest.length === 1) {
      if (ts.has(svc)) return { type: 'service-pillar', treatmentSlug: svc }
      return { type: 'not-found' }
    }

    // /services/[svc]/[state]  →  service × state
    if (rest.length === 2) {
      if (ts.has(svc) && lm.get(state)?.kind === 'state')
        return { type: 'service-state', treatmentSlug: svc, stateSlug: state }
      return { type: 'not-found' }
    }

    // /services/[svc]/[state]/[city]  →  money page
    if (rest.length === 3) {
      const cLoc = lm.get(city)
      if (
        ts.has(svc) &&
        lm.get(state)?.kind === 'state' &&
        (cLoc?.kind === 'metro' || cLoc?.kind === 'city')
      )
        return { type: 'service-city-directory', treatmentSlug: svc, stateSlug: state, citySlug: city }
      return { type: 'not-found' }
    }

    // /services/[svc]/[state]/[city]/[hood]  →  service × neighborhood
    if (rest.length === 4) {
      const cLoc = lm.get(city)
      if (
        ts.has(svc) &&
        lm.get(state)?.kind === 'state' &&
        (cLoc?.kind === 'metro' || cLoc?.kind === 'city') &&
        lm.get(hood)?.kind === 'neighborhood'
      )
        return {
          type: 'service-neighborhood',
          treatmentSlug: svc,
          stateSlug: state,
          citySlug: city,
          neighborhoodSlug: hood,
        }
      return { type: 'not-found' }
    }

    return { type: 'not-found' }
  }

  // ── Find path (UX — state / city / neighborhood) ──────────────────────────────

  // ── 1 segment ────────────────────────────────────────────────────────────────
  if (segments.length === 1) {
    const [a] = segments
    const loc = lm.get(a)
    if (loc?.kind === 'state') return { type: 'state-hub', stateSlug: a }
    return { type: 'not-found' }
  }

  // ── 2 segments ────────────────────────────────────────────────────────────────
  if (segments.length === 2) {
    const [a, b] = segments
    const aLoc = lm.get(a)

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
  const activeCityEntries = cityEntries.filter((e) => activeCitySlugs.has(e.citySlug))
  const activeNeighborhoods = neighborhoods.filter((n) => activeCitySlugs.has(n.citySlug))

  // ── Services path ──────────────────────────────────────────────────────────
  // /services
  paths.push(['services'])
  // /services/[svc]
  treatSlugs.forEach((t) => paths.push(['services', t]))
  // /services/[svc]/[state]  (active states only)
  for (const t of treatSlugs) {
    for (const s of activeStateSlugs) paths.push(['services', t, s])
  }
  // /services/[svc]/[state]/[city]  (money pages)
  for (const t of treatSlugs) {
    for (const { citySlug, stateSlug } of activeCityEntries) {
      if (stateSlug) paths.push(['services', t, stateSlug, citySlug])
    }
  }
  // /services/[svc]/[state]/[city]/[hood]
  for (const t of treatSlugs) {
    for (const { slug, citySlug, stateSlug } of activeNeighborhoods) {
      if (stateSlug) paths.push(['services', t, stateSlug, citySlug, slug])
    }
  }

  // ── Find path ──────────────────────────────────────────────────────────────
  // /[state]
  stateSlugs.forEach((s) => paths.push([s]))
  // /[state]/[city]
  for (const { citySlug, stateSlug } of activeCityEntries) {
    if (stateSlug) paths.push([stateSlug, citySlug])
  }
  // /[state]/[city]/[neighborhood]
  for (const { slug, citySlug, stateSlug } of activeNeighborhoods) {
    if (stateSlug) paths.push([stateSlug, citySlug, slug])
  }

  return paths
}
