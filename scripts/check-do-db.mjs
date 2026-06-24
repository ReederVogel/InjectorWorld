import pg from 'pg'
const { Client } = pg

const c = new Client({
  connectionString: process.env.DATABASE_URI,
  ssl: { rejectUnauthorized: false, checkServerIdentity: () => undefined },
})

await c.connect()

const counts = await c.query(`
  SELECT 'clinics'    AS tbl, COUNT(*) AS n FROM clinics
  UNION ALL SELECT 'reviews',    COUNT(*) FROM reviews
  UNION ALL SELECT 'locations',  COUNT(*) FROM locations
  UNION ALL SELECT 'treatments', COUNT(*) FROM treatments
  UNION ALL SELECT 'zip_codes',  COUNT(*) FROM zip_codes
  UNION ALL SELECT 'news',       COUNT(*) FROM news
  UNION ALL SELECT 'guides',     COUNT(*) FROM guides
`)
console.log('=== DO DB row counts ===')
counts.rows.forEach(r => console.log(r.tbl.padEnd(14) + r.n))

const ctypes = await c.query(`
  SELECT COALESCE(clinic_type,'NULL') AS clinic_type, COUNT(*) AS n
  FROM clinics GROUP BY clinic_type ORDER BY n DESC LIMIT 10
`)
console.log('\n=== clinic_type distribution ===')
ctypes.rows.forEach(r => console.log(r.clinic_type.padEnd(22) + r.n))

await c.end()
