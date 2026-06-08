/**
 * Local Postgres restore. DESTRUCTIVE: overwrites the public schema.
 *
 *   npm run db:restore                 (restores the most recent backup)
 *   npm run db:restore -- "<file>"     (restores a specific .dump file)
 *
 * Uses pg_restore with --clean --if-exists, so existing public-schema objects
 * are dropped and recreated from the dump. The database must already exist.
 *
 * Requires `pg_restore` on PATH, or set PGRESTORE_PATH to its full path.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
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
  console.error('DATABASE_URI is not set. Run via: npm run db:restore (uses .env.local).')
  process.exit(1)
}

const u = new URL(uri)
const host = u.hostname
const port = u.port || '5432'
const user = decodeURIComponent(u.username)
const password = decodeURIComponent(u.password)
const dbName = u.pathname.replace(/^\//, '')

const backupsDir = path.resolve(process.cwd(), '.backups')

// Pick the file: explicit arg, or the newest .dump in .backups/.
let file = process.argv[2]
if (!file) {
  if (!existsSync(backupsDir)) {
    console.error('No .backups/ folder and no file given. Run npm run db:backup first.')
    process.exit(1)
  }
  const dumps = readdirSync(backupsDir)
    .filter((f) => f.endsWith('.dump'))
    .map((f) => path.join(backupsDir, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
  if (dumps.length === 0) {
    console.error('No .dump files in .backups/. Run npm run db:backup first.')
    process.exit(1)
  }
  file = dumps[0]
  console.log(`No file given. Using most recent backup: ${file}`)
}

if (!existsSync(file)) {
  console.error(`Backup file not found: ${file}`)
  process.exit(1)
}

const pgRestore = resolvePgTool('pg_restore', process.env.PGRESTORE_PATH)

console.log(`\nDESTRUCTIVE: restoring "${dbName}" public schema from ${file}`)

const res = spawnSync(
  pgRestore,
  [
    '--clean',
    '--if-exists',
    '--no-owner',
    '--no-acl',
    '--host', host,
    '--port', port,
    '--username', user,
    '--dbname', dbName,
    file,
  ],
  { env: { ...process.env, PGPASSWORD: password }, stdio: 'inherit' },
)

if (res.error && (res.error as NodeJS.ErrnoException).code === 'ENOENT') {
  console.error(
    `\npg_restore not found. Install PostgreSQL client tools or set PGRESTORE_PATH to its full path.`,
  )
  process.exit(1)
}
// pg_restore can exit non-zero on harmless "does not exist, skipping" notices with --clean.
if (res.status !== 0) {
  console.warn('\npg_restore finished with warnings (status ' + res.status + '). Review output above.')
} else {
  console.log('\nRestore complete.')
}
