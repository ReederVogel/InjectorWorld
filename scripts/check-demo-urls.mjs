import pg from 'pg'
const { Client } = pg
const c = new Client({ connectionString: process.env.DATABASE_URI, ssl: { rejectUnauthorized: false } })
await c.connect()

// Check location slugs for key demo cities
const locs = await c.query(`
  SELECT name, slug, state, kind, is_live
  FROM locations
  WHERE (LOWER(name) IN ('houston','new york city','new york','los angeles','miami','chicago','dallas','austin')
    OR state IN ('TX','NY','CA')
  )
  AND kind IN ('city','metro','state')
  ORDER BY kind, name
  LIMIT 30
`)
console.log('=== Key Location docs ===')
locs.rows.forEach(r => console.log(`  [${r.kind}] ${r.name} | ${r.state} | slug: ${r.slug} | live: ${r.is_live}`))

// Check how many clinics we have per state
const states = await c.query(`
  SELECT state, COUNT(*) AS n, COUNT(CASE WHEN city NOT LIKE '% %' OR city ~ '^[A-Z]{2} [0-9]{5}$' THEN 1 END) AS zip_style
  FROM clinics WHERE import_batch = 'juvederm-gmaps-2026-06'
  GROUP BY state ORDER BY n DESC LIMIT 10
`)
console.log('\n=== Clinic count per state (real data) ===')
states.rows.forEach(r => console.log(`  ${r.state}: ${r.n} total, ${r.zip_style} still have ZIP-style city`))

// Sample Houston clinics
const hou = await c.query(`SELECT clinic_name, city, state, slug, status FROM clinics WHERE state='TX' AND import_batch='juvederm-gmaps-2026-06' LIMIT 5`)
console.log('\n=== Sample TX clinics ===')
hou.rows.forEach(r => console.log(`  ${r.clinic_name} | city: "${r.city}" | status: ${r.status} | slug: ${r.slug}`))

// Sample NYC clinics
const nyc = await c.query(`SELECT clinic_name, city, state, slug, status FROM clinics WHERE state='NY' AND import_batch='juvederm-gmaps-2026-06' LIMIT 5`)
console.log('\n=== Sample NY clinics ===')
nyc.rows.forEach(r => console.log(`  ${r.clinic_name} | city: "${r.city}" | status: ${r.status} | slug: ${r.slug}`))

await c.end()
