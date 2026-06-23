import { getPayloadInstance } from './payload-server'

export type LocationSlugEntry = { citySlug: string; stateSlug: string }

let _cache: Map<string, LocationSlugEntry> | null = null
let _cachedAt = 0
const CACHE_TTL = 60_000

export async function getLocationSlugMap(): Promise<Map<string, LocationSlugEntry>> {
  if (_cache && Date.now() - _cachedAt < CACHE_TTL) return _cache

  const payload = await getPayloadInstance()
  const locRes = await payload.find({ collection: 'locations', limit: 5000, depth: 0 })

  const stateCodeToSlug = new Map<string, string>()
  const map = new Map<string, LocationSlugEntry>()

  for (const loc of locRes.docs as any[]) {
    if (loc.kind === 'state' && loc.state) {
      stateCodeToSlug.set((loc.state as string).toUpperCase(), loc.slug)
    }
  }

  for (const loc of locRes.docs as any[]) {
    if (loc.kind === 'metro' || loc.kind === 'city') {
      const stateCode = (loc.state ?? '') as string
      const stateSlug = stateCodeToSlug.get(stateCode.toUpperCase()) ?? ''
      const cityName = (loc.name as string).replace(/\s+city$/i, '').trim().toLowerCase()
      const key = `${cityName},${stateCode.toLowerCase()}`
      map.set(key, { citySlug: loc.slug, stateSlug })
    }
  }

  _cache = map
  _cachedAt = Date.now()
  return map
}

export function lookupSlugs(
  city: string,
  state: string,
  slugMap: Map<string, LocationSlugEntry>,
): LocationSlugEntry {
  const cityName = city.replace(/\s+city$/i, '').trim().toLowerCase()
  const key = `${cityName},${state.toLowerCase()}`
  return (
    slugMap.get(key) ?? {
      citySlug: city
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, ''),
      stateSlug: state.toLowerCase(),
    }
  )
}
