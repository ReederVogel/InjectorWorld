/**
 * Shared data-fix functions for admin API routes and CLI scripts.
 * Each function runs the same SQL logic as the corresponding scripts/fix-*.mjs files.
 * Uses a per-call pg Pool so no connection leaks across requests.
 */

import { Pool } from 'pg'
import { getDbConnectionString, getDbSsl } from '@/lib/db-ssl'

export type DataFixResult = {
  dryRun: boolean
  rowsAffected: number
  sample: string[]
}

function makePool(): Pool {
  return new Pool({
    connectionString: getDbConnectionString(),
    ssl: getDbSsl() as any,
  })
}

// ─── 1. ZIP location backfill ─────────────────────────────────────────────────

/** Backfill city, state, lat, lng from zip_codes for clinics with bad/missing location data. */
export async function runZipBackfill(opts: { dryRun: boolean }): Promise<DataFixResult> {
  const pool = makePool()
  try {
    const affected = await pool.query<{
      id: number
      clinic_name: string
      old_city: string | null
      new_city: string
    }>(`
      SELECT
        c.id,
        c.clinic_name,
        c.city AS old_city,
        z.city AS new_city
      FROM clinics c
      JOIN zip_codes z ON c.zip = z.zip
      WHERE
        c.city IS NULL OR c.city = ''
        OR c.state IS NULL OR c.state = '' OR LENGTH(c.state) != 2
        OR c.city ~ '^\\d+'
        OR c.city = UPPER(c.city)
      ORDER BY c.id
    `)

    const sample = affected.rows.slice(0, 10).map(
      (r) => `[${r.id}] "${r.clinic_name?.slice(0, 40)}" → city: "${r.old_city ?? ''}" → "${r.new_city}"`,
    )

    if (opts.dryRun) {
      return { dryRun: true, rowsAffected: affected.rows.length, sample }
    }

    const res = await pool.query(`
      UPDATE clinics c
      SET
        city      = z.city,
        state     = z.state,
        latitude  = CASE WHEN c.latitude IS NULL OR c.latitude = 0 THEN z.lat ELSE c.latitude END,
        longitude = CASE WHEN c.longitude IS NULL OR c.longitude = 0 THEN z.lng ELSE c.longitude END,
        updated_at = NOW()
      FROM zip_codes z
      WHERE c.zip = z.zip
        AND (
          c.city IS NULL OR c.city = ''
          OR c.state IS NULL OR c.state = '' OR LENGTH(c.state) != 2
          OR c.city ~ '^\\d+'
          OR c.city = UPPER(c.city)
        )
    `)

    return { dryRun: false, rowsAffected: res.rowCount ?? 0, sample }
  } finally {
    await pool.end()
  }
}

// ─── 2. Cleanup bad clinic names ─────────────────────────────────────────────

/** Mark clinics with street-address names as status='review'. */
export async function runCleanBadNames(opts: { dryRun: boolean }): Promise<DataFixResult> {
  const pool = makePool()
  try {
    const affected = await pool.query<{ id: number; clinic_name: string; status: string }>(`
      SELECT id, clinic_name, status
      FROM clinics
      WHERE clinic_name ~ '^\\d+\\s+[A-Z0-9]'
        AND status != 'review'
      ORDER BY id
    `)

    const sample = affected.rows.slice(0, 10).map(
      (r) => `[${r.id}] (${r.status}) "${r.clinic_name}"`,
    )

    if (opts.dryRun) {
      return { dryRun: true, rowsAffected: affected.rows.length, sample }
    }

    const res = await pool.query(`
      UPDATE clinics
      SET status = 'review', updated_at = NOW()
      WHERE clinic_name ~ '^\\d+\\s+[A-Z0-9]'
        AND status != 'review'
    `)

    return { dryRun: false, rowsAffected: res.rowCount ?? 0, sample }
  } finally {
    await pool.end()
  }
}

// ─── 3. Delete ZIP-only Locations ────────────────────────────────────────────

/** Delete fake metro/city locations created from ZIP codes (e.g. "CA 90004", "90004"). */
export async function runDeleteZipLocations(opts: { dryRun: boolean }): Promise<DataFixResult> {
  const pool = makePool()
  try {
    const affected = await pool.query<{ id: number; name: string; slug: string; state: string }>(`
      SELECT id, slug, name, state
      FROM locations
      WHERE kind IN ('metro', 'city')
        AND (name ~ '^[A-Z]{2}\\s+\\d+' OR name ~ '^\\d{5}$')
      ORDER BY name
    `)

    const sample = affected.rows.slice(0, 10).map(
      (r) => `[${r.id}] "${r.name}" (slug=${r.slug}, state=${r.state})`,
    )

    if (opts.dryRun) {
      return { dryRun: true, rowsAffected: affected.rows.length, sample }
    }

    if (affected.rows.length === 0) {
      return { dryRun: false, rowsAffected: 0, sample }
    }

    const ids = affected.rows.map((r) => r.id)

    // Set isLive=false + noindex=true first so they drop out of sitemap immediately
    await pool.query(
      `UPDATE locations SET is_live = false, noindex = true, updated_at = NOW() WHERE id = ANY($1)`,
      [ids],
    )

    const res = await pool.query(`DELETE FROM locations WHERE id = ANY($1)`, [ids])

    return { dryRun: false, rowsAffected: res.rowCount ?? 0, sample }
  } finally {
    await pool.end()
  }
}

// ─── 4. Delete seed providers ─────────────────────────────────────────────────

const SEED_PROVIDER_SLUGS = [
  'lena-park-md-nyc',
  'daniel-cho-md-nyc',
  'sofia-reyes-np-nyc',
  'rachel-goldman-md-nyc',
  'omar-haddad-md-nyc',
  'maya-singh-np-nyc',
  'jenna-wu-pa-nyc',
  'elena-mosconi-md-nyc',
  'marcus-hill-md-la',
  'hailey-brennan-rn-la',
  'aisha-bello-md-mia',
  'lucas-almeida-pa-mia',
  'james-whitaker-do-chi',
  'mia-petrova-np-chi',
  'priya-shah-md-sf',
]

const SEED_CLINICS = [
  { id: 'clinic-nyc-00001', name: 'Park Avenue Aesthetics' },
  { id: 'clinic-la-00001', name: 'Rodeo Drive Dermatology' },
  { id: 'clinic-mia-00001', name: 'Brickell Aesthetic Medicine' },
  { id: 'clinic-chi-00001', name: 'River North Skin' },
  { id: 'clinic-sf-00001', name: 'Pacific Heights Dermatology' },
]

/** Delete all mock seed providers (Dr. Lena Park etc.) and their linked seed clinics. */
export async function runDeleteSeedProviders(opts: { dryRun: boolean }): Promise<DataFixResult> {
  const pool = makePool()
  try {
    const providers = await pool.query<{ id: number; slug: string; full_name: string }>(
      `SELECT id, slug, full_name FROM providers WHERE slug = ANY($1) ORDER BY slug`,
      [SEED_PROVIDER_SLUGS],
    )

    // Match BOTH clinic_id AND name to avoid deleting real data reusing a seed ID
    const clinicRows: Array<{ id: number; clinic_id: string; clinic_name: string }> = []
    for (const s of SEED_CLINICS) {
      const res = await pool.query<{ id: number; clinic_id: string; clinic_name: string }>(
        `SELECT id, clinic_id, clinic_name FROM clinics WHERE clinic_id = $1 AND clinic_name = $2`,
        [s.id, s.name],
      )
      clinicRows.push(...res.rows)
    }

    const totalCount = providers.rows.length + clinicRows.length
    const sample = [
      ...providers.rows.slice(0, 8).map((r) => `provider [${r.id}] ${r.slug}`),
      ...clinicRows.slice(0, 5).map((r) => `clinic [${r.id}] ${r.clinic_name}`),
    ]

    if (opts.dryRun) {
      return { dryRun: true, rowsAffected: totalCount, sample }
    }

    if (totalCount === 0) {
      return { dryRun: false, rowsAffected: 0, sample: ['Nothing to delete — already clean.'] }
    }

    let deleted = 0
    if (providers.rows.length > 0) {
      const res = await pool.query(`DELETE FROM providers WHERE slug = ANY($1)`, [SEED_PROVIDER_SLUGS])
      deleted += res.rowCount ?? 0
    }
    if (clinicRows.length > 0) {
      const ids = clinicRows.map((r) => r.id)
      const res = await pool.query(`DELETE FROM clinics WHERE id = ANY($1)`, [ids])
      deleted += res.rowCount ?? 0
    }

    return { dryRun: false, rowsAffected: deleted, sample }
  } finally {
    await pool.end()
  }
}
