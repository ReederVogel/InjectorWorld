import { parse } from 'csv-parse/sync'
import type { Row } from './helpers'

/** Parse CSV text into an array of row objects keyed by header name. */
export function parseCsv(text: string): Row[] {
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    // Combined files vary in width per record type; tolerate short/long rows
    // (missing trailing columns become undefined, which the helpers treat as blank).
    relax_column_count: true,
    bom: true,
  }) as Row[]
}

export type SplitRows = {
  clinics: Row[]
  providers: Row[]
  reviews: Row[]
  photos: Row[]
  qa: Row[]
  unknownTypes: Record<string, number>
}

// Accept singular/plural and a few synonyms for the record_type column.
const RECORD_TYPE_MAP: Record<string, keyof Omit<SplitRows, 'unknownTypes'>> = {
  clinic: 'clinics', clinics: 'clinics',
  provider: 'providers', providers: 'providers',
  review: 'reviews', reviews: 'reviews',
  photo: 'photos', photos: 'photos',
  qa: 'qa', 'q&a': 'qa', question: 'qa', questions: 'qa',
}

/**
 * Split a single combined CSV (one row per entity, distinguished by a
 * `record_type` column) into the per-entity arrays the import engine expects.
 * Each row keeps all its columns; the field helpers read only the columns that
 * apply to that entity, so a superset-of-columns combined file is fine.
 */
export function splitByRecordType(rows: Row[]): SplitRows {
  const out: SplitRows = { clinics: [], providers: [], reviews: [], photos: [], qa: [], unknownTypes: {} }
  for (const r of rows) {
    const raw = (r.record_type ?? r.recordType ?? r.type_of_record ?? '').toString().trim().toLowerCase()
    const target = RECORD_TYPE_MAP[raw]
    if (!target) {
      out.unknownTypes[raw || '(blank)'] = (out.unknownTypes[raw || '(blank)'] ?? 0) + 1
      continue
    }
    out[target].push(r)
  }
  return out
}
