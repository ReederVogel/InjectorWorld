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
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import path from 'node:path'

/** Find a Postgres client tool: explicit override, then the standard Windows
 * install location (highest version), then fall back to PATH. */
function resolvePgTool(exe: string, override?: string): string {
  if (override && existsSync(override)) return override
  const base = 'C:\\Program Files\\PostgreSQL'
  if (existsSync(base)) {
    const versions = readdirSync(base)
      .map((v) => parseInt(v, 10))
      .filter((n) => !Number.isNaN(n))
      .sort((a, b) => b - a)
    for (const v of versions) {
      const candidate = `${base}\\${v}\\bin\\${exe}.exe`
      if (existsSync(candidate)) return candidate
    }
  }
  return exe
}

const uri = process.env.DATABASE_URI
if (!uri) {
  console.error('DATABASE_URI is not set. Run via: npm run db:backup (uses .env.local).')
  process.exit(1)
}

const u = new URL(uri)
const host = u.hostname
const port = u.port || '5432'
const user = decodeURIComponent(u.username)
const password = decodeURIComponent(u.password)
const dbName = u.pathname.replace(/^\//, '')

const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
const backupsDir = path.resolve(process.cwd(), '.backups')
mkdirSync(backupsDir, { recursive: true })
const outFile = path.join(backupsDir, `backup-${dbName}-${stamp}.dump`)

const pgDump = resolvePgTool('pg_dump', process.env.PGDUMP_PATH)

console.log(`Backing up "${dbName}" (public schema) -> ${outFile}`)

const res = spawnSync(
  pgDump,
  [
    '--format=custom',
    '--schema=public',
    '--no-owner',
    '--no-acl',
    '--host', host,
    '--port', port,
    '--username', user,
    '--dbname', dbName,
    '--file', outFile,
  ],
  { env: { ...process.env, PGPASSWORD: password }, stdio: 'inherit' },
)

if (res.error && (res.error as NodeJS.ErrnoException).code === 'ENOENT') {
  console.error(
    `\npg_dump not found. Install PostgreSQL client tools or set PGDUMP_PATH to its full path.\n` +
      `Windows example: PGDUMP_PATH="C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe"`,
  )
  process.exit(1)
}
if (res.status !== 0) {
  console.error('\nBackup failed. See pg_dump output above.')
  process.exit(res.status ?? 1)
}

console.log(`\nDone. Restore with: npm run db:restore -- "${outFile}"`)
