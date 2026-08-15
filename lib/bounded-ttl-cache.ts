/**
 * Map with a hard entry cap and a TTL.
 *
 * The cap is the point. A plain Map used as a cache keyed on request-derived
 * data grows without limit, and "the keys are IP addresses so there cannot be
 * that many" is false whenever the key can be spoofed. When full, the oldest
 * inserted entry is dropped: JS Maps iterate in insertion order, so the first
 * key is always the oldest.
 *
 * Lived in lib/geo-ip.ts until 2026-08-15. It moved here when the listing
 * response cache needed the same guarantee, because geo-ip.ts is marked
 * `server-only` and that marker propagates to anything importing it. The class
 * itself has no server dependency at all: it is a Map with two rules. Leaving
 * it behind a server-only boundary meant the next caller either could not use
 * it or had to write a fourth unbounded Map, which is the bug this prevents.
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
