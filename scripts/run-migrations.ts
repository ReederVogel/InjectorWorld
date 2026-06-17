/**
 * run-migrations.ts
 *
 * Runs raw SQL migrations that Drizzle/Payload does NOT manage.
 *
 * Executes AFTER db-push in the build chain. db-push creates every collection's
 * table from the Payload schema first (so on a fresh database the tables these
 * migrations patch already exist); then these idempotent patches apply. Running
 * before db-push fails on a brand-new database with "relation ... does not exist"
 * because the ALTER/CREATE statements here assume their target tables exist.
 *
 * All statements use IF NOT EXISTS / DO $$ blocks — fully idempotent, so on a
 * fresh DB (where db-push already built everything) they harmlessly no-op, and
 * on a pre-existing DB they apply any missing patches. Safe to re-run on every
 * deploy.
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { getDbSsl, getDbConnectionString } from '../lib/db-ssl'

const __dirname = dirname(fileURLToPath(import.meta.url))

const DATABASE_URI = process.env.DATABASE_URI

if (!DATABASE_URI) {
  console.log('[run-migrations] No DATABASE_URI — skipping.')
  process.exit(0)
}

// Migrations to run in order. Add new ones at the bottom — never remove old ones.
const MIGRATIONS = [
  'migrate-subscribers-phase10.sql',
  'migrate-news-phase11.sql',
  'migrate-zips-phase14.sql',
]

async function run() {
  // Use pg (node-postgres) — direct dep via @payloadcms/db-postgres, always present.
  const { default: pg } = await import('pg')
  // connectionString + ssl must be used together — see lib/db-ssl.ts.
  const pool = new pg.Pool({ connectionString: getDbConnectionString(), ssl: getDbSsl() })

  for (const file of MIGRATIONS) {
    const filePath = resolve(__dirname, file)
    let script: string
    try {
      script = readFileSync(filePath, 'utf-8')
    } catch {
      console.error(`[run-migrations] File not found: ${filePath}`)
      await pool.end()
      process.exit(1)
    }

    console.log(`[run-migrations] Running ${file}...`)
    try {
      await pool.query(script)
      console.log(`[run-migrations] ✓ ${file}`)
    } catch (err) {
      console.error(`[run-migrations] ✗ ${file}:`, (err as Error)?.message)
      await pool.end()
      process.exit(1)
    }
  }

  await pool.end()
  console.log('[run-migrations] All migrations complete.')
  process.exit(0)
}

run().catch((err) => {
  console.error('[run-migrations] Fatal:', err)
  process.exit(1)
})
