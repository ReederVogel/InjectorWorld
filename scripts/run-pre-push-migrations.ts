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
 * IMPORTANT: Each statement is executed in its own pool.query() call so that
 * ALTER TYPE ... ADD VALUE commits before any subsequent DML that uses the new
 * enum value. Sending the whole file as one query wraps everything in a single
 * PostgreSQL transaction — the new enum value is invisible until commit, causing
 * "unsafe use of new value of enum type" errors on the UPDATE that follows.
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

/**
 * Split a SQL script into individual statements.
 *
 * Handles dollar-quoted blocks (DO $$ ... $$;) correctly: semicolons inside
 * $$ ... $$ are part of the block and NOT treated as statement boundaries.
 * Each returned string is one complete statement (including its trailing ;).
 */
function splitStatements(sql: string): string[] {
  const result: string[] = []
  let current = ''
  let inDollarQuote = false
  let i = 0

  while (i < sql.length) {
    // Detect $$ — toggle dollar-quote mode
    if (sql[i] === '$' && i + 1 < sql.length && sql[i + 1] === '$') {
      inDollarQuote = !inDollarQuote
      current += '$$'
      i += 2
      continue
    }

    current += sql[i]

    // Semicolon outside dollar-quoted block = statement boundary
    if (sql[i] === ';' && !inDollarQuote) {
      const stmt = current.trim()
      if (stmt.length > 0) result.push(stmt)
      current = ''
    }

    i++
  }

  // Trailing content with no semicolon (shouldn't normally happen but be safe)
  const rem = current.trim()
  if (rem.length > 0) result.push(rem)

  // Filter out statements that are empty or contain only SQL comments
  return result.filter((s) => {
    const noComments = s.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim()
    return noComments.length > 0
  })
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

  const statements = splitStatements(script)
  console.log(`[pre-push] Running ${statements.length} statements individually (each auto-commits).`)

  for (let idx = 0; idx < statements.length; idx++) {
    const stmt = statements[idx]
    try {
      await pool.query(stmt)
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err)
      console.error(`[pre-push] ✗ Failed on statement ${idx + 1}/${statements.length}: ${msg}`)
      console.error(`  → ${stmt.slice(0, 300).replace(/\s+/g, ' ')}`)
      await pool.end()
      process.exit(1)
    }
  }

  console.log('[pre-push] ✓ Pre-push patches applied.')
  await pool.end()
  process.exit(0)
}

run().catch((err) => {
  console.error('[pre-push] Fatal:', err)
  process.exit(1)
})
