/**
 * run-pre-push-migrations.ts
 *
 * Runs SQL patches that must land BEFORE db-push so Drizzle never sees
 * ambiguous schema drift (new FK columns it can't tell were "renamed or created").
 *
 * Build order: this → db-push → run-migrations → setup-search → next build
 *
 * All SQL in migrate-pre-push.sql uses DO blocks with table-existence guards,
 * so this is a no-op on a fresh database (db-push builds the schema from
 * scratch; nothing to pre-patch). On an existing prod DB it pre-creates any
 * columns that Drizzle would otherwise prompt about interactively.
 *
 * To extend: add another DO block to migrate-pre-push.sql. Never remove old
 * entries — they stay as idempotent no-ops.
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { getDbSsl, getDbConnectionString } from '../lib/db-ssl'

const __dirname = dirname(fileURLToPath(import.meta.url))

const DATABASE_URI = process.env.DATABASE_URI

if (!DATABASE_URI) {
  console.log('[pre-push] No DATABASE_URI — skipping.')
  process.exit(0)
}

async function run() {
  const { default: pg } = await import('pg')
  const pool = new pg.Pool({ connectionString: getDbConnectionString(), ssl: getDbSsl() })

  const filePath = resolve(__dirname, 'migrate-pre-push.sql')
  let script: string
  try {
    script = readFileSync(filePath, 'utf-8')
  } catch {
    console.error(`[pre-push] File not found: ${filePath}`)
    await pool.end()
    process.exit(1)
  }

  console.log('[pre-push] Applying pre-push schema patches...')
  try {
    await pool.query(script)
    console.log('[pre-push] ✓ Pre-push patches applied.')
  } catch (err) {
    console.error('[pre-push] ✗ Failed:', (err as Error)?.message)
    await pool.end()
    process.exit(1)
  }

  await pool.end()
  process.exit(0)
}

run().catch((err) => {
  console.error('[pre-push] Fatal:', err)
  process.exit(1)
})
