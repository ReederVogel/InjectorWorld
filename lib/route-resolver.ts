import { getPayloadInstance } from './payload-server'

// ── Route types ───────────────────────────────────────────────────────────────
// Services path (SEO — indexed). Everything lives under /services/*.
//   /services                                   → services-index (all services)
//   /services/[svc]                             → service-pillar
//   /services/[svc]/[state]                     → service-state
//   /services/[svc]/[state]/[city]              → service-city-directory (money page)
//
// Find path (UX — indexed for live markets)
//   /[state]                         → state-hub
//   /[state]/[city]                  → city-hub
//
// Neighborhoods are NOT routable pages. They surface as a filter on the city
// pages (driven by clinic data). Any neighborhood URL 404s.
//
// Old top-level treatment URLs (/botox, /botox/texas, /botox/texas/houston)
// resolve to not-found — they 404 cleanly. No redirects.

export type ResolvedRoute =
  | { type: 'services-index' }
  | { type: 'service-pillar'; treatmentSlug: string }
  | { type: 'service-state'; treatmentSlug: string; stateSlug: string }
  | { type: 'service-city-directory'; treatmentSlug: string; stateSlug: string; citySlug: string }
  | { type: 'brands-index' }
  | { type: 'brand-pillar'; brandSlug: string }
  | { type: 'brand-state'; brandSlug: string; stateSlug: string }
  | { type: 'brand-city-directory'; brandSlug: string; stateSlug: string; citySlug: string }
  | { type: 'state-hub'; stateSlug: string }
  | { type: 'city-hub'; stateSlug: string; citySlug: string }
  | { type: 'not-found' }

type LocationEntry = {
  id: string
  kind: string
  name: string
  stateCode: string
  parentSlug?: string
}

// Module-level caches with 60 s TTL so new services/brands/locations become
// routable without a server restart.
const CACHE_TTL_MS = 60_000
let serviceSet: Set<string> | null = null
let brandSet: Set<string> | null = null
let locationMap: Map<string, LocationEntry> | null = null
let cachedAt = 0

async function ensureCaches() {
  const stale = Date.now() - cachedAt > CACHE_TTL_MS
  if (serviceSet && brandSet && locationMap && !stale) return

  const payload = await getPayloadInstance()

  const [svcRes, brandRes] = await Promise.all([
    payload.find({ collection: 'services', limit: 500, depth: 0 }),
    payload.find({ collection: 'brands', limit: 500, depth: 0 }),
  ])
  serviceSet = new Set(svcRes.docs.map((t: any) => t.slug as string))
  brandSet = new Set(brandRes.docs.map((b: any) => b.slug as string))

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
  const ss = serviceSet!
  const bs = brandSet!
  const lm = locationMap!

  if (segments.length === 0) return { type: 'not-found' }

  // ── Services path (/services/*) ───────────────────────────────────────────────
  if (segments[0] === 'services') {
    const rest = segments.slice(1)
    if (rest.length === 0) return { type: 'services-index' }
    const [svc, state, city] = rest
    if (rest.length === 1) {
      if (ss.has(svc)) return { type: 'service-pillar', treatmentSlug: svc }
      return { type: 'not-found' }
    }
    if (rest.length === 2) {
      if (ss.has(svc) && lm.get(state)?.kind === 'state')
        return { type: 'service-state', treatmentSlug: svc, stateSlug: state }
      return { type: 'not-found' }
    }
    if (rest.length === 3) {
      const cLoc = lm.get(city)
      if (ss.has(svc) && lm.get(state)?.kind === 'state' && (cLoc?.kind === 'metro' || cLoc?.kind === 'city'))
        return { type: 'service-city-directory', treatmentSlug: svc, stateSlug: state, citySlug: city }
      return { type: 'not-found' }
    }
    return { type: 'not-found' }
  }

  // ── Brands path (/brands/*) ───────────────────────────────────────────────────
  if (segments[0] === 'brands') {
    const rest = segments.slice(1)
    if (rest.length === 0) return { type: 'brands-index' }
    const [brand, state, city] = rest
    if (rest.length === 1) {
      if (bs.has(brand)) return { type: 'brand-pillar', brandSlug: brand }
      return { type: 'not-found' }
    }
    if (rest.length === 2) {
      if (bs.has(brand) && lm.get(state)?.kind === 'state')
        return { type: 'brand-state', brandSlug: brand, stateSlug: state }
      return { type: 'not-found' }
    }
    if (rest.length === 3) {
      const cLoc = lm.get(city)
      if (bs.has(brand) && lm.get(state)?.kind === 'state' && (cLoc?.kind === 'metro' || cLoc?.kind === 'city'))
        return { type: 'brand-city-directory', brandSlug: brand, stateSlug: state, citySlug: city }
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

  // ── 3+ segments (Find path) ──────────────────────────────────────────────────
  // Neighborhoods are no longer routable, so the Find path stops at city.
  return { type: 'not-found' }
}

// getAllRoutePaths — used by generateStaticParams.
// Pre-renders only paths backed by real data; ISR handles the rest on first visit.
export async function getAllRoutePaths(): Promise<string[][]> {
  const payload = await getPayloadInstance()
  const [svcRes, brandRes, locRes, clinicsRes] = await Promise.all([
    payload.find({ collection: 'services', limit: 500, depth: 0 }),
    payload.find({ collection: 'brands', limit: 500, depth: 0 }),
    payload.find({ collection: 'locations', limit: 5000, depth: 1 }),
    payload.find({
      collection: 'clinics',
      where: { status: { equals: 'published' } },
      limit: 2000,
      depth: 0,
    }),
  ])

  const svcSlugs: string[] = svcRes.docs.map((t: any) => t.slug)
  const brandSlugs: string[] = brandRes.docs.map((b: any) => b.slug)
  const stateSlugs: string[] = []
  const stateCodeToSlug = new Map<string, string>()
  const citySlugToStateSlug = new Map<string, string>()
  const cityEntries: Array<{ citySlug: string; stateSlug: string; providerCount: number }> = []
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
      cityEntries.push({ citySlug: loc.slug, stateSlug, providerCount: loc.providerCount ?? 0 })
      citySlugToStateSlug.set(loc.slug, stateSlug)
    }
  }

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
  const activeCityEntries = cityEntries.filter((e) => activeCitySlugs.has(e.citySlug) && e.stateSlug)
  const TOP_SERVICE_CITIES = 60
  const TOP_BRAND_CITIES = 60
  const TOP_FIND_CITIES = 200
  const rankedCities = [...activeCityEntries].sort((a, b) => b.providerCount - a.providerCount)
  const topServiceCities = rankedCities.slice(0, TOP_SERVICE_CITIES)
  const topBrandCities = rankedCities.slice(0, TOP_BRAND_CITIES)
  const topFindCities = rankedCities.slice(0, TOP_FIND_CITIES)

  // ── Services path ──────────────────────────────────────────────────────────
  paths.push(['services'])
  svcSlugs.forEach((t) => paths.push(['services', t]))
  for (const t of svcSlugs) {
    for (const s of activeStateSlugs) paths.push(['services', t, s])
  }
  for (const t of svcSlugs) {
    for (const { citySlug, stateSlug } of topServiceCities) {
      paths.push(['services', t, stateSlug, citySlug])
    }
  }

  // ── Brands path ────────────────────────────────────────────────────────────
  paths.push(['brands'])
  brandSlugs.forEach((b) => paths.push(['brands', b]))
  for (const b of brandSlugs) {
    for (const s of activeStateSlugs) paths.push(['brands', b, s])
  }
  for (const b of brandSlugs) {
    for (const { citySlug, stateSlug } of topBrandCities) {
      paths.push(['brands', b, stateSlug, citySlug])
    }
  }

  // ── Find path ──────────────────────────────────────────────────────────────
  stateSlugs.forEach((s) => paths.push([s]))
  for (const { citySlug, stateSlug } of topFindCities) {
    paths.push([stateSlug, citySlug])
  }

  return paths
}
