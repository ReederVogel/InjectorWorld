/**
 * seed-zips.ts — Seed the zip_codes table from GeoNames US postal codes.
 *
 *   npm run seed:zips
 *
 * Downloads the GeoNames US.txt (tab-separated, ~4 MB) to a temp file,
 * extracts it, and bulk-inserts ~42 000 rows via raw SQL in batches of 1000.
 * Idempotent: uses ON CONFLICT (zip) DO UPDATE so re-running refreshes data.
 *
 * Source: GeoNames US postal codes (CC BY 4.0)
 * https://download.geonames.org/export/zip/US.zip
 *
 * GeoNames tab columns (0-indexed):
 *   0  country_code   (always "US")
 *   1  postal_code    -> zip
 *   2  place_name     -> city
 *   3  admin_name1    (state full name, ignored)
 *   4  admin_code1    -> state (2-letter)
 *   5  admin_name2    -> county
 *   6-8 sub-area codes (ignored)
 *   9  latitude       -> lat
 *  10  longitude      -> lng
 *  11  accuracy       (ignored)
 */

import { createWriteStream, createReadStream, existsSync, mkdirSync, rmSync } from 'fs'
import { readFile } from 'fs/promises'
import { resolve, join } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import { getDbConnectionString, getDbSsl } from '../lib/db-ssl'

const __dirname = resolve(fileURLToPath(import.meta.url), '..')
const ROOT = resolve(__dirname, '..')
const TMP_DIR = join(ROOT, '.tmp-zips')
const ZIP_FILE = join(TMP_DIR, 'US.zip')
const TXT_FILE = join(TMP_DIR, 'US.txt')
const GEONAMES_URL = 'https://download.geonames.org/export/zip/US.zip'
const BATCH = 1000

const DATABASE_URI = process.env.DATABASE_URI
if (!DATABASE_URI) {
  console.error('[seed:zips] No DATABASE_URI — set it with --env-file=.env.local')
  process.exit(1)
}

async function downloadFile(url: string, dest: string): Promise<void> {
  console.log(`[seed:zips] Downloading ${url} ...`)
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`)
  const buf = await res.arrayBuffer()
  const { writeFile } = await import('fs/promises')
  await writeFile(dest, Buffer.from(buf))
  console.log(`[seed:zips] Saved to ${dest}`)
}

function extractZip(zipPath: string, destDir: string): void {
  console.log('[seed:zips] Extracting ZIP ...')
  if (process.platform === 'win32') {
    execSync(
      `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`,
      { stdio: 'pipe' },
    )
  } else {
    // macOS / Linux: `unzip` is standard.
    execSync(`unzip -o "${zipPath}" "US.txt" -d "${destDir}"`, { stdio: 'pipe' })
  }
}

type ZipRow = { zip: string; city: string; state: string; county: string; lat: number; lng: number }

async function parseGeoNames(txtPath: string): Promise<ZipRow[]> {
  const content = await readFile(txtPath, 'utf8')
  const rows: ZipRow[] = []
  for (const line of content.split('\n')) {
    const cols = line.split('\t')
    if (cols.length < 11) continue
    const zip = cols[1].trim()
    if (!/^\d{5}$/.test(zip)) continue // skip non-5-digit ZIPs
    const state = cols[4].trim()
    // Blank state = APO/FPO/DPO military mail or a US-affiliated territory with no
    // 2-letter state code. Real USPS data, but no clinic will ever have one of
    // these as an address, so they only add noise to the admin list. Skip them.
    if (!state) continue
    const lat = parseFloat(cols[9])
    const lng = parseFloat(cols[10])
    if (!isFinite(lat) || !isFinite(lng)) continue
    rows.push({
      zip,
      city: cols[2].trim(),
      state,
      county: cols[5].trim(),
      lat,
      lng,
    })
  }
  return rows
}

async function bulkInsert(pool: any, rows: ZipRow[]): Promise<void> {
  let inserted = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const vals: any[] = []
    const placeholders = batch.map((r, j) => {
      const base = j * 6
      vals.push(r.zip, r.city, r.state, r.county || null, r.lat, r.lng)
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, now(), now())`
    })
    await pool.query(
      `INSERT INTO zip_codes (zip, city, state, county, lat, lng, updated_at, created_at)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (zip) DO UPDATE SET
         city       = EXCLUDED.city,
         state      = EXCLUDED.state,
         county     = EXCLUDED.county,
         lat        = EXCLUDED.lat,
         lng        = EXCLUDED.lng,
         updated_at = now()`,
      vals,
    )
    inserted += batch.length
    process.stdout.write(`\r[seed:zips] Inserted ${inserted} / ${rows.length} rows ...`)
  }
  console.log()
}

async function main() {
  mkdirSync(TMP_DIR, { recursive: true })

  // Download if not already present.
  if (!existsSync(TXT_FILE)) {
    if (!existsSync(ZIP_FILE)) {
      await downloadFile(GEONAMES_URL, ZIP_FILE)
    }
    extractZip(ZIP_FILE, TMP_DIR)
  } else {
    console.log('[seed:zips] Using cached US.txt (delete .tmp-zips/ to re-download)')
  }

  if (!existsSync(TXT_FILE)) {
    throw new Error(`[seed:zips] Could not find ${TXT_FILE} after extraction.`)
  }

  console.log('[seed:zips] Parsing GeoNames data ...')
  const rows = await parseGeoNames(TXT_FILE)
  console.log(`[seed:zips] Parsed ${rows.length} ZIP codes`)

  // Spot-check.
  const sample = rows.find((r) => r.zip === '10001')
  if (sample) console.log(`[seed:zips] Sample 10001: ${sample.city}, ${sample.state} (${sample.lat}, ${sample.lng})`)

  // Connect to DB.
  const { default: pg } = await import('pg')
  const pool = new pg.Pool({ connectionString: getDbConnectionString(), ssl: getDbSsl() })

  // Ensure table exists (migration should have already run, but seed is standalone).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "zip_codes" (
      "id"         serial PRIMARY KEY,
      "zip"        varchar(5)       NOT NULL,
      "city"       varchar          NOT NULL,
      "state"      varchar(2)       NOT NULL,
      "county"     varchar,
      "lat"        double precision NOT NULL,
      "lng"        double precision NOT NULL,
      "updated_at" timestamp with time zone,
      "created_at" timestamp with time zone
    )
  `)
  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS zip_codes_zip_idx ON zip_codes (zip)`,
  )
  await pool.query(
    `CREATE INDEX IF NOT EXISTS zip_codes_city_idx ON zip_codes USING btree (lower(city))`,
  )

  await bulkInsert(pool, rows)

  // Verification spot-checks.
  const checks = await pool.query(`
    SELECT zip, city, state, lat, lng FROM zip_codes
    WHERE zip IN ('10001', '90210', '33139')
    ORDER BY zip
  `)
  console.log('[seed:zips] Spot checks:')
  for (const r of checks.rows) {
    console.log(`  ${r.zip}: ${r.city}, ${r.state} (${r.lat}, ${r.lng})`)
  }

  const count = await pool.query(`SELECT count(*)::int AS n FROM zip_codes`)
  console.log(`[seed:zips] Total rows in zip_codes: ${count.rows[0].n}`)

  await pool.end()

  // Clean up temp files (leave .tmp-zips/ so re-runs are fast; remove with --clean flag).
  if (process.argv.includes('--clean')) {
    rmSync(TMP_DIR, { recursive: true, force: true })
    console.log('[seed:zips] Cleaned temp files.')
  }

  // Re-link zip_codes.location_id now that the raw ZIP data has been refreshed,
  // so the join (scripts/backfill-zip-locations.ts) never goes stale after a re-run.
  console.log('[seed:zips] Re-linking zip_codes to locations...')
  execSync('npx tsx scripts/backfill-zip-locations.ts', { stdio: 'inherit', cwd: ROOT })

  console.log('[seed:zips] Done.')
  process.exit(0)
}

main().catch((err) => {
  console.error('[seed:zips] Failed:', err)
  process.exit(1)
})
