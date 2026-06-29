/**
 * One-time DO DB data fixes.
 *
 * Fixes applied:
 *  1. Keep imported news staged       (draft + noindex)
 *  2. Keep imported guides staged     (draft + noindex)
 *  3. Capitalize Juvederm brand name  (juvederm -> Juvederm, slug stays juvederm)
 *  4. Fix ZIP-based location names    (e.g. "TX 77057" → real city name from zip_codes)
 *  5. Title-case ALL CAPS location names
 *  6. Verify: print clinics_rels count for Juvederm (sanity check)
 *
 * Usage:
 *   DATABASE_URI=<do-uri> NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/fix-do-db.mjs
 */

import pg from 'pg'
const { Client } = pg

const URI = process.env.DATABASE_URI
if (!URI) { console.error('DATABASE_URI not set'); process.exit(1) }

const c = new Client({ connectionString: URI, ssl: { rejectUnauthorized: false } })
await c.connect()
console.log('\n===== DO DB Data Fixes =====\n')

// ─── 1. Approve imported news ─────────────────────────────────────────────────
{
  const res = await c.query(`
    UPDATE news
    SET status        = 'draft',
        review_status = 'imported',
        index_state   = 'noindex',
        nofollow      = true
    WHERE review_status = 'imported'
  `)
  console.log(`[1] News kept staged:  ${res.rowCount} rows`)
}

// ─── 2. Approve imported guides ───────────────────────────────────────────────
{
  const res = await c.query(`
    UPDATE guides
    SET status        = 'draft',
        review_status = 'imported',
        index_state   = 'noindex',
        nofollow      = true
    WHERE review_status = 'imported'
  `)
  console.log(`[2] Guides kept staged: ${res.rowCount} rows`)
}

// ─── 3. Fix Juvederm treatment name ──────────────────────────────────────────
{
  const res = await c.query(`
    UPDATE brands
    SET name = 'Juvederm'
    WHERE slug = 'juvederm' AND name != 'Juvederm'
  `)
  console.log(`[3] Juvederm name fixed: ${res.rowCount} rows`)
}

// ─── 4. Fix ZIP-based location names ─────────────────────────────────────────
// Locations with names like "TX 77057", "CA 90210" etc.
{
  const res = await c.query(`
    UPDATE locations l
    SET name = z.city
    FROM zip_codes z
    WHERE l.name ~ '^[A-Z]{2} [0-9]{5}$'
      AND z.zip = split_part(l.name, ' ', 2)
      AND z.city IS NOT NULL
      AND z.city <> ''
  `)
  console.log(`[4] ZIP-based location names fixed: ${res.rowCount} rows`)
}

// ─── 5. Title-case ALL CAPS location names ────────────────────────────────────
// Uses initcap() (PostgreSQL built-in) to convert UPPER CASE → Title Case.
// Only applies to names where all letters are uppercase (ignores mixed-case names).
{
  const res = await c.query(`
    UPDATE locations
    SET name = initcap(name)
    WHERE name = upper(name)
      AND name ~ '[A-Z]'
      AND name !~ '^[A-Z]{2} [0-9]{5}$'
  `)
  console.log(`[5] ALL CAPS location names title-cased: ${res.rowCount} rows`)
}

// ─── 6. Sanity checks ─────────────────────────────────────────────────────────
console.log('\n--- Sanity checks ---')

const newsCount = await c.query(`SELECT COUNT(*) FROM news WHERE review_status = 'approved'`)
console.log(`  Approved news:    ${newsCount.rows[0].count}`)

const guideCount = await c.query(`SELECT COUNT(*) FROM guides WHERE review_status = 'approved'`)
console.log(`  Approved guides:  ${guideCount.rows[0].count}`)

const brandCheck = await c.query(`SELECT name, slug FROM brands WHERE slug = 'juvederm'`)
console.log(`  Juvederm brand: name="${brandCheck.rows[0]?.name}" slug="${brandCheck.rows[0]?.slug}"`)

const juvClinics = await c.query(`
  SELECT COUNT(*) FROM clinics_rels cr
  JOIN brands b ON b.id = cr.brands_id
  WHERE cr.path = 'brandsOffered' AND b.slug = 'juvederm'
`)
console.log(`  Clinics linked to Juvederm (clinics_rels): ${juvClinics.rows[0].count}`)

const clinicPublished = await c.query(`SELECT COUNT(*) FROM clinics WHERE status = 'published'`)
console.log(`  Published clinics: ${clinicPublished.rows[0].count}`)

const zipLeftover = await c.query(`SELECT COUNT(*) FROM locations WHERE name ~ '^[A-Z]{2} [0-9]{5}$'`)
console.log(`  Remaining ZIP-name locations: ${zipLeftover.rows[0].count}`)

await c.end()
console.log('\n===== Done =====\n')
