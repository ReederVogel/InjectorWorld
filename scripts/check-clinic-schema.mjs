import pg from 'pg'
const { Client } = pg
const c = new Client({ connectionString: process.env.DATABASE_URI, ssl: { rejectUnauthorized: false } })
await c.connect()

const cols = await c.query(`
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'clinics'
  ORDER BY ordinal_position
`)
console.log('=== clinics table columns ===')
cols.rows.forEach(r => console.log(`  ${r.column_name.padEnd(32)} ${r.data_type.padEnd(20)} ${r.is_nullable}`))

const enums = await c.query(`
  SELECT t.typname, string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS values
  FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
  WHERE t.typname IN ('enum_clinics_status', 'enum_clinics_clinic_type', 'enum_clinics_service_type')
  GROUP BY t.typname
`)
console.log('\n=== relevant enums ===')
enums.rows.forEach(r => console.log(`  ${r.typname}: ${r.values}`))

await c.end()
