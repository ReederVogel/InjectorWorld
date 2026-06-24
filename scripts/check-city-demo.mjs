import pg from 'pg'
const { Client } = pg
const c = new Client({ connectionString: process.env.DATABASE_URI, ssl: { rejectUnauthorized: false } })
await c.connect()

// Check real ZIP-style cities remaining (state+5digit pattern)
const zipStyle = await c.query(`
  SELECT COUNT(*) AS n FROM clinics
  WHERE city ~ '^[A-Z]{2}\\s+[0-9]{5}$'
  AND import_batch = 'juvederm-gmaps-2026-06'
`)
console.log(`Clinics with unresolved ZIP-style city: ${zipStyle.rows[0].n}`)

// Check Houston
const houston = await c.query(`SELECT name, slug, is_live FROM locations WHERE LOWER(name) LIKE '%houston%'`)
console.log('\n=== Houston locations ===')
houston.rows.forEach(r => console.log(`  ${r.name} | ${r.slug} | live: ${r.is_live}`))

const houClinics = await c.query(`SELECT COUNT(*) AS n FROM clinics WHERE LOWER(city) = 'houston' AND state = 'TX' AND import_batch='juvederm-gmaps-2026-06'`)
console.log(`Houston TX clinics (published): ${houClinics.rows[0].n}`)

// Check NYC
const nyc = await c.query(`SELECT name, slug, is_live FROM locations WHERE LOWER(name) IN ('new york','new york city') AND kind='metro'`)
console.log('\n=== NYC locations ===')
nyc.rows.forEach(r => console.log(`  ${r.name} | ${r.slug} | live: ${r.is_live}`))

const nycClinics = await c.query(`SELECT COUNT(*) AS n FROM clinics WHERE LOWER(city) IN ('new york','new york city') AND state = 'NY' AND import_batch='juvederm-gmaps-2026-06'`)
console.log(`NYC NY clinics: ${nycClinics.rows[0].n}`)

// Check LA
const la = await c.query(`SELECT name, slug, is_live FROM locations WHERE LOWER(name) IN ('los angeles') AND kind='metro'`)
console.log('\n=== LA locations ===')
la.rows.forEach(r => console.log(`  ${r.name} | ${r.slug} | live: ${r.is_live}`))

const laClinics = await c.query(`SELECT COUNT(*) AS n FROM clinics WHERE LOWER(city) LIKE '%los angeles%' AND state = 'CA' AND import_batch='juvederm-gmaps-2026-06'`)
console.log(`LA CA clinics: ${laClinics.rows[0].n}`)

// Overall count
const total = await c.query(`
  SELECT
    COUNT(*) AS total_clinics,
    COUNT(CASE WHEN status = 'published' THEN 1 END) AS published,
    COUNT(*) FILTER (WHERE import_batch = 'juvederm-gmaps-2026-06') AS real_data
  FROM clinics
`)
console.log(`\n=== Total DB state ===`)
total.rows.forEach(r => console.log(`  Total: ${r.total_clinics} | Published: ${r.published} | Real import: ${r.real_data}`))

const reviews = await c.query(`SELECT COUNT(*) AS n FROM reviews WHERE import_batch = 'juvederm-gmaps-2026-06'`)
console.log(`  Real reviews: ${reviews.rows[0].n}`)

await c.end()
