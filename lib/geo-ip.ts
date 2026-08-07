import 'server-only'

/**
 * Shared IP validation + coarse geo lookup.
 *
 * This module exists because the same job was implemented twice, and the two
 * copies did not agree on what was safe:
 *
 *   - lib/analytics/server.ts had the careful version: it resolved the client
 *     address through getIp() (trusted proxy hop), filtered private ranges, and
 *     capped outbound lookups per minute.
 *   - app/api/geo/ip/route.ts had the loose version: it read the LEFTMOST
 *     X-Forwarded-For entry (which the caller writes), never checked that the
 *     value was an IP address at all, interpolated it straight into an outbound
 *     URL, had no rate limit, and cached results in an unbounded Map keyed by
 *     that same caller-controlled string.
 *
 * That last combination was the actual bug worth fixing. A Map with no size
 * bound, keyed on a value an attacker chooses, is a memory exhaustion primitive:
 * send a different X-Forwarded-For on every request and the process grows until
 * it dies. Nothing evicted, nothing capped.
 *
 * Everything here is written so both callers get the strict behaviour.
 */

/**
 * Addresses that must never be sent to a third-party geo service, because they
 * are not routable and the lookup would be meaningless (or would leak internal
 * topology). Covers loopback, RFC1918, link-local, CGNAT, and IPv6 equivalents.
 */
const NON_PUBLIC_V4 = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT 100.64.0.0/10
  /^(22[4-9]|2[3-5]\d)\./, // multicast + reserved
]

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
// Deliberately permissive on IPv6 shape but strict on the alphabet: only hex
// digits and colons may appear, which is what keeps the value safe to place in
// a URL below.
const IPV6 = /^[0-9a-fA-F:]{2,45}$/

/**
 * True only for a syntactically valid, publicly routable IP address.
 *
 * The original code checked a private-range prefix and accepted everything else,
 * which meant any arbitrary string that did not happen to start with `10.` sailed
 * through and was interpolated into an outbound URL. Validating the FORMAT, and
 * only then excluding private ranges, is the right order: it rejects the whole
 * class of "not even an IP" inputs instead of enumerating bad ones.
 */
export function isPublicIpAddress(value: string | null | undefined): value is string {
  if (!value) return false
  const ip = value.trim()
  if (!ip || ip.length > 45) return false

  const v4 = IPV4.exec(ip)
  if (v4) {
    const octets = v4.slice(1, 5).map(Number)
    if (octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) return false
    // Reject "01.2.3.4" style leading zeros: some parsers read those as octal,
    // so accepting them means two systems can disagree about which host it is.
    if (v4.slice(1, 5).some((s) => s.length > 1 && s.startsWith('0'))) return false
    return !NON_PUBLIC_V4.some((re) => re.test(ip))
  }

  if (IPV6.test(ip) && ip.includes(':')) {
    const lower = ip.toLowerCase()
    if (lower === '::1' || lower === '::') return false
    if (lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) return false
    // ::ffff:a.b.c.d is an IPv4 address wearing an IPv6 hat; the v4 branch above
    // is where those belong, so refuse rather than pass it through unchecked.
    if (lower.startsWith('::ffff:')) return false
    return true
  }

  return false
}

/**
 * Map with a hard entry cap and a TTL.
 *
 * The cap is the point. A plain Map used as a cache keyed on request-derived
 * data grows without limit, and "the keys are IP addresses so there cannot be
 * that many" is false whenever the key can be spoofed. When full, the oldest
 * inserted entry is dropped — JS Maps iterate in insertion order, so the first
 * key is always the oldest.
 */
export class BoundedTtlCache<V> {
  private readonly map = new Map<string, { value: V; at: number }>()

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
  ) {}

  get(key: string): V | undefined {
    const hit = this.map.get(key)
    if (!hit) return undefined
    if (Date.now() - hit.at >= this.ttlMs) {
      this.map.delete(key)
      return undefined
    }
    return hit.value
  }

  set(key: string, value: V): void {
    if (this.map.size >= this.maxEntries && !this.map.has(key)) {
      const oldest = this.map.keys().next().value
      if (oldest !== undefined) this.map.delete(oldest)
    }
    this.map.set(key, { value, at: Date.now() })
  }

  get size(): number {
    return this.map.size
  }
}

export type GeoResult = {
  city: string | null
  state: string | null
  stateCode: string | null
  zip: string | null
  lat: number | null
  lng: number | null
}

export const NULL_GEO: GeoResult = {
  city: null,
  state: null,
  stateCode: null,
  zip: null,
  lat: null,
  lng: null,
}

/**
 * 5,000 entries is far more than the real concurrent-visitor count and small
 * enough that a full cache is a rounding error in memory terms.
 */
const geoCache = new BoundedTtlCache<GeoResult>(5000, 60 * 60 * 1000)

/**
 * ip-api.com's free tier allows 45 requests/minute per origin IP and bans the
 * caller past that. Staying under it matters for availability, not just
 * politeness: without this cap, one visitor spike (or one attacker) gets the
 * production server's address blocked and the feature dies for everybody.
 */
const MAX_LOOKUPS_PER_MIN = 40
let lookupsThisWindow = 0
let windowStart = Date.now()

/**
 * Endpoint is overridable so a paid or self-hosted provider can be swapped in
 * without a code change.
 *
 * WHY THE DEFAULT IS http:// AND NOT https://.
 *
 * ip-api.com serves TLS only on its paid tier; the free endpoint is plaintext,
 * so "just use https" would silently break geo entirely rather than harden it.
 * The tradeoff being accepted: a network observer between this server and
 * ip-api.com can see which visitor IP was looked up, and can tamper with the
 * response to return a wrong city. No credential and no user content is in the
 * request, and a wrong city name is cosmetic, so the blast radius is small.
 *
 * It is still a real privacy leak to anyone on that path. If geo becomes
 * load-bearing, move to a TLS provider or a local MaxMind database and set
 * GEOIP_ENDPOINT accordingly.
 */
const GEOIP_ENDPOINT = process.env.GEOIP_ENDPOINT || 'http://ip-api.com/json'

/**
 * Coarse geo for a client IP. Returns NULL_GEO for anything invalid, private,
 * over budget, or failing — never throws, because every caller treats geo as
 * optional decoration.
 */
export async function lookupGeo(ip: string | null | undefined): Promise<GeoResult> {
  if (!isPublicIpAddress(ip)) return NULL_GEO

  const cached = geoCache.get(ip)
  if (cached) return cached

  const now = Date.now()
  if (now - windowStart > 60 * 1000) {
    windowStart = now
    lookupsThisWindow = 0
  }
  if (lookupsThisWindow >= MAX_LOOKUPS_PER_MIN) return NULL_GEO
  lookupsThisWindow++

  try {
    // isPublicIpAddress has already restricted the value to digits, dots, hex
    // and colons, so this cannot alter the URL structure. Encoded anyway so the
    // safety does not depend on that validation staying exactly as strict.
    const url = `${GEOIP_ENDPOINT}/${encodeURIComponent(ip)}?fields=status,city,regionName,region,zip,lat,lon`
    const res = await fetch(url, { signal: AbortSignal.timeout(3000), cache: 'no-store' })
    if (!res.ok) return NULL_GEO

    const d: any = await res.json()
    if (d?.status !== 'success') return NULL_GEO

    const result: GeoResult = {
      city: typeof d.city === 'string' ? d.city || null : null,
      state: typeof d.regionName === 'string' ? d.regionName || null : null,
      stateCode: typeof d.region === 'string' ? d.region || null : null,
      zip: typeof d.zip === 'string' ? d.zip || null : null,
      lat: typeof d.lat === 'number' && Number.isFinite(d.lat) ? d.lat : null,
      lng: typeof d.lon === 'number' && Number.isFinite(d.lon) ? d.lon : null,
    }
    geoCache.set(ip, result)
    return result
  } catch {
    return NULL_GEO
  }
}
