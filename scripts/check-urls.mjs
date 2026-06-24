import pg from 'pg'
const { Client } = pg
const c = new Client({ connectionString: process.env.DATABASE_URI, ssl: { rejectUnauthorized: false } })
await c.connect()

// State slugs
const states = await c.query(`SELECT name, slug, state FROM locations WHERE kind='state' ORDER BY name`)
console.log('=== State Location slugs ===')
states.rows.forEach(r => console.log(`  ${r.state}: ${r.name} | slug: ${r.slug}`))

// Houston specifically
const hou = await c.query(`SELECT name, slug, kind, state FROM locations WHERE LOWER(name) LIKE '%houston%'`)
console.log('\n=== Houston ===')
hou.rows.forEach(r => console.log(`  [${r.kind}] ${r.name} | ${r.state} | slug: ${r.slug}`))

// NYC specifically
const nyc = await c.query(`SELECT name, slug, kind, state FROM locations WHERE LOWER(name) IN ('new york city','new york') AND kind='metro'`)
console.log('\n=== NYC ===')
nyc.rows.forEach(r => console.log(`  [${r.kind}] ${r.name} | ${r.state} | slug: ${r.slug}`))

// So demo URLs would be:
console.log('\n=== DEMO URLS (3-level: /treatment/state/city) ===')
const pairs = await c.query(`
  SELECT
    st.slug AS state_slug,
    m.slug AS city_slug,
    m.name AS city_name,
    m.state AS state_code
  FROM locations m
  JOIN locations st ON m.state = st.state AND st.kind = 'state'
  WHERE m.kind = 'metro'
  AND LOWER(m.name) IN ('houston','new york city','new york','los angeles','miami','chicago','dallas','beverly hills')
  ORDER BY m.name
`)
pairs.rows.forEach(r =>
  console.log(`  /botox/${r.state_slug}/${r.city_slug}  (${r.city_name}, ${r.state_code})`)
)

await c.end()
