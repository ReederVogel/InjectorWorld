/**
 * run-migrations.ts
 *
 * Runs raw SQL migrations that Drizzle/Payload does NOT manage.
 * Executes before db-push in the build chain so drizzle-kit never sees
 * schema drift that triggers interactive "create or rename?" prompts in CI.
 *
 * All statements use IF NOT EXISTS / DO $$ blocks — fully idempotent.
 * Safe to re-run on every deploy.
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

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
]

async function run() {
  // Use pg (node-postgres) — direct dep via @payloadcms/db-postgres, always present.
  const { default: pg } = await import('pg')
  const pool = new pg.Pool({ connectionString: DATABASE_URI! })

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
