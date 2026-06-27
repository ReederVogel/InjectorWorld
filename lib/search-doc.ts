/**
 * Provider search-doc denormalization (Phase 13).
 *
 * Treatments, specialties, and languages live in tables SEPARATE from the
 * `providers` row, so they cannot go into an expression index on `providers`.
 * They are denormalized into an isolated `search.provider_doc` tsvector table
 * (created + fully rebuilt by scripts/setup-search-indexes.ts). This hook keeps
 * that side table fresh on individual provider edits so admin/dashboard changes
 * reflect quickly.
 *
 * SAFETY: this is strictly a search ENHANCEMENT layered on top of the always-fresh
 * in-row provider full-text (name/title/tagline/bio) AND the intent parser (which
 * also covers treatments). So a stale or missing side-doc row only degrades
 * extra matching, never correctness. Every operation is best-effort and wrapped in
 * try/catch: a side-table failure must never break a provider save. The full
 * rebuild in `npm run setup:search` is the correctness backstop. We write to a
 * DIFFERENT table than the one being saved, via the raw pool, so there is no
 * same-row deadlock (the Phase 7 afterChange lesson).
 */
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { providerDocTsv } from './search-sql'

// Treatment id -> name. Small, rarely-changing set; cache to avoid a query per save.
let treatmentCache: { at: number; map: Map<number, string> } | null = null
const TREATMENT_TTL_MS = 5 * 60 * 1000

async function treatmentNameMap(pool: any): Promise<Map<number, string>> {
  if (treatmentCache && Date.now() - treatmentCache.at < TREATMENT_TTL_MS) return treatmentCache.map
  const map = new Map<number, string>()
  try {
    const res = await pool.query(`SELECT id, name FROM services`)
    for (const r of res.rows) map.set(Number(r.id), String(r.name))
    treatmentCache = { at: Date.now(), map }
  } catch {
    // Keep whatever we had; an empty map just means treatments fall back to the
    // intent parser + the next full rebuild.
    if (!treatmentCache) treatmentCache = { at: Date.now(), map }
  }
  return treatmentCache.map
}

/** Flatten an array field into a space-joined string (strings, numbers, or {key}). */
function flatten(value: any, key?: string): string {
  if (!Array.isArray(value)) return ''
  return value
    .map((v) => {
      if (v == null) return ''
      if (typeof v === 'string' || typeof v === 'number') return String(v)
      if (key && typeof v === 'object') return v[key] ?? ''
      return ''
    })
    .filter(Boolean)
    .join(' ')
}

/** Upsert one provider's extra-doc row in search.provider_doc. */
export async function upsertProviderDoc(
  pool: any,
  providerId: number,
  treatments: string,
  specialties: string,
  languages: string,
): Promise<void> {
  const expr = providerDocTsv('$2', '$3', '$4')
  await pool.query(
    `INSERT INTO search.provider_doc (provider_id, doc, updated_at)
     VALUES ($1, ${expr}, now())
     ON CONFLICT (provider_id) DO UPDATE SET doc = EXCLUDED.doc, updated_at = now()`,
    [providerId, treatments, specialties, languages],
  )
}

export const denormalizeProviderSearchDoc: CollectionAfterChangeHook = async ({ doc, req }) => {
  try {
    const pool = (req.payload.db as any).pool
    if (!pool || doc?.id == null) return doc
    const names = await treatmentNameMap(pool)
    const treatments = (Array.isArray(doc.treatmentsOffered) ? doc.treatmentsOffered : [])
      .map((t: any) =>
        t && typeof t === 'object' ? t.name ?? names.get(Number(t.id)) ?? '' : names.get(Number(t)) ?? '',
      )
      .filter(Boolean)
      .join(' ')
    const specialties = flatten(doc.specialties, 'name')
    const languages = flatten(doc.languages)
    await upsertProviderDoc(pool, Number(doc.id), treatments, specialties, languages)
  } catch {
    // best-effort, see file header.
  }
  return doc
}

export const removeProviderSearchDoc: CollectionAfterDeleteHook = async ({ id, req }) => {
  try {
    const pool = (req.payload.db as any).pool
    if (!pool || id == null) return
    await pool.query(`DELETE FROM search.provider_doc WHERE provider_id = $1`, [Number(id)])
  } catch {
    // best-effort.
  }
}
