/**
 * audit-data-pre-deploy.mjs
 * Read-only. Run before AND after fix scripts to verify counts.
 * Usage: node scripts/audit-data-pre-deploy.mjs
 */
import pg from 'pg'

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URI || 'postgres://postgres:admin@localhost:5432/injectors_world_dev', ssl: process.env.DB_SSL_CA ? { ca: Buffer.from(process.env.DB_SSL_CA, 'base64').toString() } : false })

async function q(sql, params = []) {
  const res = await pool.query(sql, params)
  return res.rows
}

async function main() {
  console.log('\n======= PRE-DEPLOY DATA AUDIT =======\n')

  // Row counts
  const counts = await q(`
    SELECT 'clinics'   AS tbl, COUNT(*) AS n FROM clinics   UNION ALL
    SELECT 'providers',        COUNT(*)       FROM providers UNION ALL
    SELECT 'reviews',          COUNT(*)       FROM reviews   UNION ALL
    SELECT 'locations',        COUNT(*)       FROM locations UNION ALL
    SELECT 'zip_codes',        COUNT(*)       FROM zip_codes UNION ALL
    SELECT 'news',             COUNT(*)       FROM news      UNION ALL
    SELECT 'guides',           COUNT(*)       FROM guides
    ORDER BY tbl
  `)
  console.log('── Row counts ──────────────────────────')
  counts.forEach(r => console.log(`  ${r.tbl.padEnd(12)} ${r.n}`))

  // Clinics by status
  const byStatus = await q(`SELECT status, COUNT(*) AS n FROM clinics GROUP BY status ORDER BY status`)
  console.log('\n── Clinics by status ───────────────────')
  byStatus.forEach(r => console.log(`  ${(r.status || 'null').padEnd(10)} ${r.n}`))

  // Bad data counts
  const [badNames] = await q(`SELECT COUNT(*) AS n FROM clinics WHERE clinic_name ~ '^\\d+\\s+[A-Z0-9]'`)
  const [allCapsCities] = await q(`SELECT COUNT(*) AS n FROM clinics WHERE city = UPPER(city) AND LENGTH(city) > 2 AND city != ''`)
  const [allCapsNames] = await q(`SELECT COUNT(*) AS n FROM clinics WHERE clinic_name = UPPER(clinic_name) AND LENGTH(clinic_name) > 3`)
  const [zipMetros] = await q(`SELECT COUNT(*) AS n FROM locations WHERE kind IN ('metro','city') AND (name ~ '^[A-Z]{2}\\s+\\d+' OR name ~ '^\\d{5}$')`)
  const [oldSlugsLoc] = await q(`SELECT COUNT(*) AS n FROM locations WHERE kind IN ('metro','city') AND slug ~ '-[a-z]{2}$' AND slug != 'washington-dc'`)
  const [doubleCitySlug] = await q(`SELECT COUNT(*) AS n FROM clinics WHERE slug ~ '(houston-houston|dallas-dallas|miami-miami|york-york|angeles-angeles|chicago-chicago|francisco-francisco)'`)
  const [seedProviders] = await q(`SELECT COUNT(*) AS n FROM providers WHERE slug IN ('lena-park-md-nyc','daniel-cho-md-nyc','marcus-hill-md-la','rachel-goldman-md-nyc','aisha-bello-md-mia','james-whitaker-do-chi','priya-shah-md-sf','mia-petrova-np-chi','sofia-reyes-np-nyc','omar-haddad-md-nyc','elena-mosconi-md-nyc','hailey-brennan-rn-la','lucas-almeida-pa-mia','jenna-wu-pa-nyc','maya-singh-np-nyc')`)
  const [zipMetrosLive] = await q(`SELECT COUNT(*) AS n FROM locations WHERE kind IN ('metro','city') AND (name ~ '^[A-Z]{2}\\s+\\d+' OR name ~ '^\\d{5}$') AND is_live = true`)

  console.log('\n── Bad data ────────────────────────────')
  console.log(`  Street-address clinic names     ${badNames.n}`)
  console.log(`  ALL CAPS city field             ${allCapsCities.n}`)
  console.log(`  ALL CAPS clinic names           ${allCapsNames.n}`)
  console.log(`  ZIP-only metro locations        ${zipMetros.n}  (${zipMetrosLive.n} are isLive=true)`)
  console.log(`  City slugs with old -xx suffix  ${oldSlugsLoc.n}`)
  console.log(`  Double-city clinic slugs        ${doubleCitySlug.n}`)
  console.log(`  Seed providers still in DB      ${seedProviders.n}`)

  // Live markets
  const liveStates = await q(`SELECT slug, name FROM locations WHERE kind='state' AND is_live=true ORDER BY name`)
  console.log('\n── Live states ─────────────────────────')
  if (liveStates.length === 0) console.log('  (none)')
  else liveStates.forEach(r => console.log(`  ${r.slug}  ${r.name}`))

  const liveCities = await q(`SELECT COUNT(*) AS n FROM locations WHERE kind IN ('metro','city') AND is_live=true`)
  console.log(`  Live cities/metros: ${liveCities[0].n}`)

  console.log('\n======= END AUDIT =======\n')
  await pool.end()
}

main().catch(err => { console.error(err); process.exit(1) })
