/**
 * Local Postgres backup.
 *
 *   npm run db:backup
 *
 * Dumps the `public` schema (all Payload tables) of the database in DATABASE_URI
 * to .backups/backup-<timestamp>.dump in pg_dump custom format. The `postgis`
 * schema is intentionally excluded so restores never touch the PostGIS extension.
 *
 * Requires `pg_dump` on PATH. If it is not, set PGDUMP_PATH to its full path,
 * e.g. PGDUMP_PATH="C:\Program Files\PostgreSQL\18\bin\pg_dump.exe".
 *
 * Run BEFORE any import or schema change. This is your data undo button.
 *
 * The actual dump logic lives in lib/db-backup-core.ts (shared with the admin
 * Backup button and the auto-backup-before-wipe safety step).
 */
import { backupDatabase } from '../lib/db-backup-core'

try {
  const { file } = backupDatabase()
  console.log(`\nDone. Restore with: npm run db:restore -- "${file}"`)
} catch (err: any) {
  console.error(`\nBackup failed: ${err?.message ?? err}`)
  process.exit(1)
}
