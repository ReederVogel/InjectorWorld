/**
 * CSV cleaner for juvederm_2026-06-07 (1).csv
 *
 * Fixes:
 *   1. Pad 4-digit ZIPs to 5 digits (NJ and others)
 *   2. Look up missing city / state / lat / lng from zip_codes table
 *   3. Title-case ALL CAPS city names
 *   4. Strip Florida/state medical license codes from clinic names: (ME12345), (OS1234), etc.
 *   5. Title-case ALL CAPS clinic names
 *   6. Normalize multiple internal spaces to one
 *
 * Usage:
 *   node scripts/clean-juvederm-csv.mjs                          (local DB, default I/O)
 *   node scripts/clean-juvederm-csv.mjs --dry-run                (stats only, no file written)
 *   node scripts/clean-juvederm-csv.mjs --input=path/to/file.csv --output=data/out.csv
 *   DATABASE_URI=<remote> node scripts/clean-juvederm-csv.mjs    (use remote for ZIP lookup)
 */

import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { fileURLToPath } from 'url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const INPUT  = args.find(a => a.startsWith('--input='))?.slice(8)
  ?? 'C:\\Users\\risha\\Downloads\\juvederm_2026-06-07 (1).csv'
const OUTPUT = args.find(a => a.startsWith('--output='))?.slice(9)
  ?? path.join(ROOT, 'data', 'juvederm-cleaned-2026-06.csv')

const LOCAL_DB = 'postgres://postgres:admin@localhost:5432/injectors_world_dev'
const DB_URI   = process.env.DATABASE_URI ?? LOCAL_DB

// ─── Title-case helpers ───────────────────────────────────────────────────────

// Words that must stay ALL-CAPS in both city and clinic names
const KEEP_UPPER = new Set([
  // US state abbreviations
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
  // Business / legal suffixes
  'LLC','LLP','PLLC','DBA','PC',
  // Medical credentials
  'MD','DO','NP','RN','DMD','DDS','DPM','FACS','FAAD','APRN','PA','PA-C',
  // Common acronyms seen in clinic names
  'USA','MRI','IV','BBL','IPL','HIFU','LASIK',
])

/**
 * Returns true when every letter in str is uppercase (ignoring digits/punctuation).
 * A string with NO letters returns false (nothing to title-case).
 */
function isAllCaps(str) {
  const letters = str.replace(/[^a-zA-Z]/g, '')
  return letters.length > 0 && letters === letters.toUpperCase()
}

/**
 * Title-case a single space-delimited token.
 * Handles leading non-alpha chars: "4EVER" → "4Ever", "17MEDSPA" → "17Medspa"
 */
function titleToken(word) {
  if (!word) return word
  // Split leading non-alpha prefix from the alpha body (e.g. "4" + "EVER")
  const m = word.match(/^([^A-Za-z]*)([A-Za-z].*)?$/)
  if (!m) return word
  const [, prefix, alpha] = m
  if (!alpha) return word           // digits/symbols only
  const upper = alpha.toUpperCase()
  if (KEEP_UPPER.has(upper)) return prefix + upper
  return prefix + alpha[0].toUpperCase() + alpha.slice(1).toLowerCase()
}

/**
 * Title-case the full string only if it is entirely uppercase.
 * Mixed-case strings (already have lowercase) are returned unchanged.
 */
function smartTitleCase(str) {
  if (!str || !isAllCaps(str)) return str
  return str
    .split(/(\s+)/)                  // split on whitespace (preserve it)
    .map((chunk, i) => i % 2 === 1  // odd indexes = whitespace runs
      ? ' '                          // collapse to single space
      : chunk.split('-').map(titleToken).join('-')   // handle hyphenated words
    )
    .join('')
    .trim()
}

// ─── License code stripper ────────────────────────────────────────────────────
// Matches Florida/state medical license codes like (ME12345), (OS8398), (DN7155), (PA9100637)
// Also handles no-space variant: "Estima Aesthetics(ME71082)"
const LICENSE_RE = /\s*\([A-Z]{1,2}\d{4,8}\)\s*/g

function stripLicenseCodes(name) {
  return name.replace(LICENSE_RE, ' ').replace(/\s{2,}/g, ' ').trim()
}

// ─── CSV parser ───────────────────────────────────────────────────────────────

function parseLine(line) {
  const result = []
  let cur = '', inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
      else inQ = !inQ
    } else if (ch === ',' && !inQ) {
      result.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur)
  return result
}

function csvEscape(val) {
  if (val == null) return ''
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n===== Juvederm CSV Cleaner =====')
  console.log(`Input:    ${INPUT}`)
  console.log(`Output:   ${OUTPUT}`)
  console.log(`Dry run:  ${DRY_RUN}`)
  console.log(`DB:       ${DB_URI.replace(/:[^:@]+@/, ':***@')}\n`)

  if (!fs.existsSync(INPUT)) {
    console.error(`ERROR: Input file not found: ${INPUT}`)
    process.exit(1)
  }

  // Connect to DB for ZIP lookup
  const isRemote = !/[@](localhost|127\.0\.0\.1)[:/]/.test(DB_URI)
  const ssl = isRemote ? { rejectUnauthorized: false } : false
  const pool = new pg.Pool({ connectionString: DB_URI, ssl })

  console.log('Loading ZIP codes from DB...')
  const zipRes = await pool.query('SELECT zip, city, state, lat, lng FROM zip_codes')
  /** @type {Map<string, {city:string, state:string, lat:number, lng:number}>} */
  const zipMap = new Map()
  for (const row of zipRes.rows) {
    zipMap.set(row.zip, {
      city:  row.city,
      state: row.state,
      lat:   parseFloat(row.lat),
      lng:   parseFloat(row.lng),
    })
  }
  console.log(`  Loaded ${zipMap.size.toLocaleString()} ZIP codes.\n`)

  // Stats counters
  const stats = {
    total:           0,
    zipPadded:       0,
    cityFilled:      0,
    stateFilled:     0,
    latLngFilled:    0,
    cityCased:       0,
    nameLicenseStripped: 0,
    nameCased:       0,
    noLatLng:        0,    // rows that still have no lat/lng after fix (will be skipped by importer)
    noZip:           0,    // rows with no ZIP at all
  }

  // Read all lines first so we can write the cleaned file
  const rl = readline.createInterface({
    input: fs.createReadStream(INPUT, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })

  let headers = []
  const cleanedRows = []

  for await (const rawLine of rl) {
    const line = rawLine.trimEnd()
    if (!line) continue

    if (!headers.length) {
      headers = parseLine(line)
      cleanedRows.push(line)   // keep original header row
      continue
    }

    stats.total++
    const vals  = parseLine(line)
    const r     = Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']))

    // ── 1. Pad short ZIPs ──────────────────────────────────────────────────
    let zip = (r.zip ?? '').trim().replace(/[^0-9]/g, '')   // digits only
    if (zip.length > 0 && zip.length < 5) {
      const padded = zip.padStart(5, '0')
      r.zip = padded
      zip   = padded
      stats.zipPadded++
    } else {
      r.zip = zip || r.zip  // keep original if already 5 digits or empty
    }
    if (!zip) stats.noZip++

    // ── 2. ZIP lookups for missing city / state / lat / lng ────────────────
    const zd = zip ? zipMap.get(zip) : null

    if (zd) {
      if (!r.city?.trim()) {
        r.city = zd.city
        stats.cityFilled++
      }
      if (!r.state?.trim()) {
        r.state = zd.state
        stats.stateFilled++
      }
      const lat = parseFloat(r.latitude)
      const lng = parseFloat(r.longitude)
      if ((isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0)) {
        r.latitude  = String(zd.lat)
        r.longitude = String(zd.lng)
        stats.latLngFilled++
      }
    }

    // Still no lat/lng? Count it (importer will skip)
    const latFinal = parseFloat(r.latitude)
    const lngFinal = parseFloat(r.longitude)
    if (isNaN(latFinal) || isNaN(lngFinal)) stats.noLatLng++

    // ── 3. City title-case ─────────────────────────────────────────────────
    const city = (r.city ?? '').trim()
    if (city && isAllCaps(city)) {
      r.city = smartTitleCase(city)
      stats.cityCased++
    }

    // ── 4. Clinic name: strip license codes ───────────────────────────────
    const rawName = (r.clinic_name ?? '').trim()
    const nameNoLicense = stripLicenseCodes(rawName)
    if (nameNoLicense !== rawName) {
      r.clinic_name = nameNoLicense
      stats.nameLicenseStripped++
    }

    // ── 5. Clinic name: title-case if ALL CAPS ────────────────────────────
    const nameAfterLicense = r.clinic_name.trim()
    if (nameAfterLicense && isAllCaps(nameAfterLicense)) {
      r.clinic_name = smartTitleCase(nameAfterLicense)
      stats.nameCased++
    }

    // ── Write cleaned row ──────────────────────────────────────────────────
    cleanedRows.push(headers.map(h => csvEscape(r[h] ?? '')).join(','))

    if (stats.total % 1000 === 0) {
      process.stdout.write(`\r  Processed: ${stats.total.toLocaleString()}    `)
    }
  }

  console.log(`\r  Processed: ${stats.total.toLocaleString()}    \n`)

  // ── Report ─────────────────────────────────────────────────────────────────
  console.log('=== Cleaning summary ===')
  console.log(`  Total rows:              ${stats.total.toLocaleString()}`)
  console.log(`  ZIPs padded (→ 5 digits):${String(stats.zipPadded).padStart(7)}`)
  console.log(`  City filled (ZIP lookup): ${String(stats.cityFilled).padStart(6)}`)
  console.log(`  State filled (ZIP lookup):${String(stats.stateFilled).padStart(6)}`)
  console.log(`  Lat/Lng filled (ZIP look):${String(stats.latLngFilled).padStart(6)}`)
  console.log(`  City title-cased:         ${String(stats.cityCased).padStart(6)}`)
  console.log(`  License codes stripped:   ${String(stats.nameLicenseStripped).padStart(6)}`)
  console.log(`  Clinic names title-cased: ${String(stats.nameCased).padStart(6)}`)
  console.log(`  Still missing lat/lng:    ${String(stats.noLatLng).padStart(6)}  (will be skipped by importer)`)
  console.log(`  No ZIP at all:            ${String(stats.noZip).padStart(6)}`)
  console.log('')
  console.log(`  Output rows (incl. header): ${cleanedRows.length.toLocaleString()}`)

  if (DRY_RUN) {
    console.log('\n  (Dry run — no file written)\n')
    await pool.end()
    return
  }

  // ── Write output CSV ───────────────────────────────────────────────────────
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
  fs.writeFileSync(OUTPUT, cleanedRows.join('\n') + '\n', 'utf8')
  console.log(`\n  Written to: ${OUTPUT}\n`)

  // ── Sample: show 5 rows where names changed ────────────────────────────────
  console.log('=== Sample cleaned names (first 5 with license code stripped) ===')
  let shown = 0
  for (const rowLine of cleanedRows.slice(1)) {
    const v = parseLine(rowLine)
    const name = v[headers.indexOf('clinic_name')]
    if (/^\d/.test(name) || shown > 0) {
      console.log(` - ${name} | ${v[headers.indexOf('city')]}, ${v[headers.indexOf('state')]}`)
      shown++
      if (shown >= 5) break
    }
  }

  await pool.end()
  console.log('\n===== Done =====\n')
}

main().catch(e => { console.error(e); process.exit(1) })
