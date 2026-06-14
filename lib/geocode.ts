import { getPayloadInstance } from './payload-server'

/**
 * Geocoding adapter (ROADMAP Phase 5).
 *
 * Turns a typed location ("Beverly Hills", a zip, an address) into coordinates so
 * search can run a PostGIS radius query. Provider is swappable via the GEOCODER
 * env var; Nominatim (OpenStreetMap, free) is the launch default.
 *
 * Privacy: only the location string is ever sent to the provider. Never names,
 * emails, or any PII. "near me" is NOT geocoded here (it needs the browser's
 * navigator.geolocation); callers pass those coordinates directly.
 *
 * Caching: results are cached in-memory (per process) and in the isolated
 * `search.geocode_cache` table (created by scripts/setup-search-indexes.ts) so we
 * stay polite to the free Nominatim endpoint and fast on repeat queries.
 */

export type GeocodeResult = { lat: number; lng: number; label: string }

const PROVIDER = (process.env.GEOCODER ?? 'nominatim').toLowerCase()
const NOMINATIM_BASE =
  process.env.NOMINATIM_BASE_URL ?? 'https://nominatim.openstreetmap.org/search'
// Nominatim's usage policy requires a meaningful User-Agent identifying the app.
const USER_AGENT =
  process.env.GEOCODER_USER_AGENT ?? 'injector.world/1.0 (https://injector.world)'
// Mapbox Geocoding API token (set GEOCODER=mapbox + MAPBOX_TOKEN for production).
const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN

const memCache = new Map<string, GeocodeResult | null>()

// Nominatim asks for <= 1 request/second. Serialize outbound calls and space them.
let lastCallAt = 0
const MIN_INTERVAL_MS = 1100
async function throttle() {
  const wait = lastCallAt + MIN_INTERVAL_MS - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastCallAt = Date.now()
}

function normalizeKey(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Lookups we never send to the network (handled client-side or meaningless). */
function isUngeocodable(q: string): boolean {
  const k = normalizeKey(q)
  return k === '' || k === 'near me' || k === 'current location' || k === 'my location'
}

async function readDbCache(key: string): Promise<GeocodeResult | null | undefined> {
  try {
    const payload = await getPayloadInstance()
    const pool = (payload.db as any).pool
    const res = await pool.query(
      `SELECT lat, lng, label FROM search.geocode_cache WHERE query = $1`,
      [key],
    )
    if (res.rows.length === 0) return undefined
    const row = res.rows[0]
    if (row.lat == null || row.lng == null) return null // cached "not found"
    // bump hit count (best-effort)
    pool
      .query(
        `UPDATE search.geocode_cache SET hit_count = hit_count + 1, updated_at = now() WHERE query = $1`,
        [key],
      )
      .catch(() => {})
    return { lat: Number(row.lat), lng: Number(row.lng), label: row.label ?? key }
  } catch {
    return undefined
  }
}

async function writeDbCache(key: string, result: GeocodeResult | null) {
  try {
    const payload = await getPayloadInstance()
    const pool = (payload.db as any).pool
    await pool.query(
      `INSERT INTO search.geocode_cache (query, lat, lng, label, provider)
         VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (query) DO UPDATE
         SET lat = EXCLUDED.lat, lng = EXCLUDED.lng, label = EXCLUDED.label,
             provider = EXCLUDED.provider, updated_at = now()`,
      [key, result?.lat ?? null, result?.lng ?? null, result?.label ?? null, PROVIDER],
    )
  } catch {
    // Cache write is best-effort; a failure must never break search.
  }
}

async function nominatim(query: string): Promise<GeocodeResult | null> {
  await throttle()
  const url = new URL(NOMINATIM_BASE)
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '1')
  url.searchParams.set('countrycodes', 'us') // US-only launch markets
  url.searchParams.set('addressdetails', '0')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6000)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!res.ok) return null
    const data = (await res.json()) as any[]
    if (!Array.isArray(data) || data.length === 0) return null
    const top = data[0]
    const lat = Number(top.lat)
    const lng = Number(top.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return { lat, lng, label: top.display_name ?? query }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

async function mapbox(query: string): Promise<GeocodeResult | null> {
  if (!MAPBOX_TOKEN) {
    console.warn('[geocode] MAPBOX_TOKEN not set — falling back to Nominatim. Set GEOCODER=mapbox + MAPBOX_TOKEN for production.')
    return nominatim(query)
  }
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
  )
  url.searchParams.set('access_token', MAPBOX_TOKEN)
  url.searchParams.set('country', 'US')
  url.searchParams.set('limit', '1')
  url.searchParams.set('types', 'place,district,locality,neighborhood,postcode,address')
  url.searchParams.set('language', 'en')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6000)
  try {
    const res = await fetch(url.toString(), { signal: controller.signal })
    if (!res.ok) return null
    const data = (await res.json()) as any
    if (!Array.isArray(data.features) || data.features.length === 0) return null
    const [lng, lat] = data.features[0].center as [number, number]
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return { lat, lng, label: data.features[0].place_name ?? query }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

async function provider(query: string): Promise<GeocodeResult | null> {
  switch (PROVIDER) {
    case 'mapbox':
      return mapbox(query)
    case 'nominatim':
    default:
      return nominatim(query)
  }
}

/**
 * Geocode a typed location string. Returns null when it cannot be resolved
 * (including "near me", which must come from the browser).
 */
export async function geocode(query: string): Promise<GeocodeResult | null> {
  if (isUngeocodable(query)) return null
  const key = normalizeKey(query)

  if (memCache.has(key)) return memCache.get(key) ?? null

  const cached = await readDbCache(key)
  if (cached !== undefined) {
    memCache.set(key, cached)
    return cached
  }

  const result = await provider(query)
  memCache.set(key, result)
  await writeDbCache(key, result)
  return result
}
