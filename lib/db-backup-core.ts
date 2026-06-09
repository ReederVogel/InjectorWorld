/**
 * Reusable Postgres backup helper. Shared by the `db:backup` script, the admin
 * "Backup" button (/api/admin/backup), and the auto-backup-before-wipe safety
 * step (/api/admin/wipe + scripts/wipe-data.ts).
 *
 * Dumps the `public` schema of DATABASE_URI to .backups/backup-<db>-<ts>.dump
 * in pg_dump custom format. The `postgis` schema is excluded so restores never
 * touch the PostGIS extension. Requires pg_dump on PATH or PGDUMP_PATH.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

/** Find a Postgres client tool: explicit override, then the standard Windows
 * install location (highest version), then fall back to PATH. */
export function resolvePgTool(exe: string, override?: string): string {
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

export type BackupResult = { file: string; bytes: number }

/**
 * Run pg_dump and return the created file path. Throws on any failure so callers
 * (e.g. the wipe flow) can abort when no backup could be taken.
 */
export function backupDatabase(): BackupResult {
  const uri = process.env.DATABASE_URI
  if (!uri) throw new Error('DATABASE_URI is not set.')

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
    { env: { ...process.env, PGPASSWORD: password }, stdio: 'pipe' },
  )

  if (res.error && (res.error as NodeJS.ErrnoException).code === 'ENOENT') {
    throw new Error('pg_dump not found. Install PostgreSQL client tools or set PGDUMP_PATH.')
  }
  if (res.status !== 0) {
    const stderr = res.stderr ? res.stderr.toString() : ''
    throw new Error(`pg_dump failed (status ${res.status}). ${stderr}`.trim())
  }

  const bytes = existsSync(outFile) ? statSync(outFile).size : 0
  return { file: outFile, bytes }
}

/** Most recent backup file info, or null if none exists. */
export function latestBackup(): { file: string; bytes: number; mtime: string } | null {
  const backupsDir = path.resolve(process.cwd(), '.backups')
  if (!existsSync(backupsDir)) return null
  const dumps = readdirSync(backupsDir)
    .filter((f) => f.endsWith('.dump'))
    .map((f) => path.join(backupsDir, f))
  if (dumps.length === 0) return null
  const newest = dumps.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0]
  const st = statSync(newest)
  return { file: newest, bytes: st.size, mtime: st.mtime.toISOString() }
}
