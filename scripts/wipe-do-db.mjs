import pg from 'pg'
const { Client } = pg

const c = new Client({
  connectionString: process.env.DATABASE_URI,
  ssl: { rejectUnauthorized: false },
})

await c.connect()
console.log('\n===== Wiping DO DB (direct SQL) =====\n')

// Order matters — FK dependencies first
const tables = [
  'reviews', 'photos', 'before_after_cases', 'qa',
  'bookings', 'claims', 'promotions', 'data_alerts',
  'providers', 'clinics',
  'news', 'guides',
]

for (const t of tables) {
  try {
    const count = await c.query(`SELECT COUNT(*) AS n FROM "${t}"`)
    const n = count.rows[0].n
    if (n === '0') { console.log(`  ${t.padEnd(22)} 0  (empty)`); continue }
    await c.query(`DELETE FROM "${t}"`)
    console.log(`  ${t.padEnd(22)} deleted ${n} rows`)
  } catch (err) {
    console.error(`  ${t}: ERROR — ${err.message}`)
  }
}

console.log('\n===== Verifying =====')
const counts = await c.query(`
  SELECT 'clinics'    AS tbl, COUNT(*) AS n FROM clinics
  UNION ALL SELECT 'reviews',    COUNT(*) FROM reviews
  UNION ALL SELECT 'providers',  COUNT(*) FROM providers
  UNION ALL SELECT 'news',       COUNT(*) FROM news
  UNION ALL SELECT 'guides',     COUNT(*) FROM guides
`)
counts.rows.forEach(r => console.log(`  ${r.tbl.padEnd(14)} ${r.n}`))

await c.end()
console.log('\n===== Done =====\n')
