/**
 * Reusable Postgres backup helper. Shared by the `db:backup` script, the admin
 * "Backup" button (/api/admin/backup), and the auto-backup-before-wipe safety
 * step (/api/admin/wipe + scripts/wipe-data.ts).
 *
 * Primary: pg_dump custom format (set PGDUMP_PATH to override binary location).
 * Fallback: JSON export via `pg` if pg_dump fails (e.g. version mismatch).
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
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

export type BackupResult = { file: string; bytes: number; r2Url?: string }

/**
 * Run pg_dump and return the created file path. Throws on any failure so callers
 * (e.g. the wipe flow) can abort when no backup could be taken.
 * Also uploads to R2 when R2 env vars are configured (Railway/DO local fs is ephemeral).
 */
export async function backupDatabase(): Promise<BackupResult> {
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
    console.warn('[backup] pg_dump not found — falling back to JSON export.')
    return backupDatabaseJson(uri, stamp, backupsDir)
  }
  if (res.status !== 0) {
    const stderr = res.stderr ? res.stderr.toString() : ''
    // Version mismatch or other pg_dump error — fall back to JSON so wipe can proceed.
    console.warn(`[backup] pg_dump failed (status ${res.status}): ${stderr.slice(0, 200)} — falling back to JSON export.`)
    return backupDatabaseJson(uri, stamp, backupsDir)
  }

  const bytes = existsSync(outFile) ? statSync(outFile).size : 0

  // Upload to R2 so the backup persists across ephemeral Railway/DO restarts.
  const r2Url = await uploadBackupToR2(outFile)
  if (r2Url) console.log(`[backup] Uploaded to R2: ${r2Url}`)

  return { file: outFile, bytes, r2Url: r2Url ?? undefined }
}

/**
 * JSON-based backup via the `pg` driver — no pg_dump needed.
 * Exports all user-data tables to a single .json file in .backups/.
 * Not pg_restore-able directly, but preserves all data for emergency recovery.
 */
async function backupDatabaseJson(uri: string, stamp: string, backupsDir: string): Promise<BackupResult> {
  const { Client } = await import('pg')
  // Managed Postgres on DO/Railway uses a self-signed CA — rejectUnauthorized must be false.
  const client = new Client({ connectionString: uri, ssl: { rejectUnauthorized: false } })
  await client.connect()

  const tables = [
    'clinics', 'providers', 'reviews', 'photos', 'before_after_cases',
    'bookings', 'claims', 'promotions', 'data_alerts', 'qa', 'newsletter_subscribers',
    'audit_logs', 'zip_codes', 'users',
  ]

  const data: Record<string, unknown[]> = {}
  for (const table of tables) {
    try {
      const res = await client.query(`SELECT * FROM "${table}" LIMIT 50000`)
      data[table] = res.rows
    } catch {
      data[table] = []
    }
  }
  await client.end()

  const outFile = path.join(backupsDir, `backup-json-${stamp}.json`)
  writeFileSync(outFile, JSON.stringify({ exportedAt: new Date().toISOString(), tables: data }, null, 2))
  const bytes = statSync(outFile).size

  const r2Url = await uploadBackupToR2(outFile)
  if (r2Url) console.log(`[backup] JSON backup uploaded to R2: ${r2Url}`)

  return { file: outFile, bytes, r2Url: r2Url ?? undefined }
}

/**
 * Upload a local backup file to Cloudflare R2 (or any S3-compatible store).
 * Called automatically by backupDatabase() when R2 env vars are present.
 * Returns the public URL of the uploaded file, or null if upload was skipped/failed.
 *
 * This is critical for Railway/DigitalOcean deploys where the local filesystem
 * is ephemeral — local backup files are wiped on every restart/redeploy.
 */
export async function uploadBackupToR2(localFile: string): Promise<string | null> {
  const { R2_BUCKET, R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_URL } =
    process.env
  if (!R2_BUCKET || !R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) return null

  try {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
    const { readFileSync } = await import('node:fs')

    const s3 = new S3Client({
      region: 'auto',
      endpoint: R2_ENDPOINT,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
      forcePathStyle: true,
    })

    const key = `backups/${path.basename(localFile)}`
    await s3.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: readFileSync(localFile),
        ContentType: 'application/octet-stream',
      }),
    )

    return R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : key
  } catch (err) {
    console.warn('[backup] R2 upload failed (local copy still saved):', err)
    return null
  }
}

/** Most recent backup file info (either pg_dump .dump or JSON .json fallback), or null. */
export function latestBackup(): { file: string; bytes: number; mtime: string } | null {
  const backupsDir = path.resolve(process.cwd(), '.backups')
  if (!existsSync(backupsDir)) return null
  const dumps = readdirSync(backupsDir)
    .filter((f) => f.endsWith('.dump') || f.endsWith('.json'))
    .map((f) => path.join(backupsDir, f))
  if (dumps.length === 0) return null
  const newest = dumps.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0]
  const st = statSync(newest)
  return { file: newest, bytes: st.size, mtime: st.mtime.toISOString() }
}
