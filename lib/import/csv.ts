import { parse } from 'csv-parse/sync'
import type { Row } from './helpers'

/** Parse CSV text into an array of row objects keyed by header name. */
export function parseCsv(text: string): Row[] {
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    bom: true,
  }) as Row[]
}
