import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdmin, requireAdminOrEditor } from '@/lib/auth-guards'
import { backupDatabase, latestBackup } from '@/lib/db-backup-core'
import path from 'node:path'

export const runtime = 'nodejs'

/** GET → info on the most recent backup (for the "last backup" timestamp). */
export async function GET() {
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdminOrEditor(user)
  if (guard) return guard

  const last = latestBackup()
  if (!last) return NextResponse.json({ last: null })
  return NextResponse.json({
    last: { file: path.basename(last.file), bytes: last.bytes, mtime: last.mtime },
  })
}

/**
 * POST → take a new backup now.
 * Admin-only: editors cannot trigger backups.
 * r2Url is logged server-side only — never returned to the client.
 */
export async function POST() {
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdmin(user)
  if (guard) return guard

  try {
    const { file, bytes, r2Url } = await backupDatabase()
    console.log('[BACKUP] URL:', r2Url)
    return NextResponse.json({
      success: true,
      filename: path.basename(file),
      size: bytes,
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    return NextResponse.json({ error: `Backup failed: ${err?.message ?? 'unknown error'}` }, { status: 500 })
  }
}
