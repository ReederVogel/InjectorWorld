import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { backupDatabase, latestBackup } from '@/lib/db-backup-core'
import path from 'node:path'

export const runtime = 'nodejs'

async function requireAdmin() {
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  if (!user || (user.role !== 'admin' && user.role !== 'editor')) return null
  return user
}

/** GET → info on the most recent backup (for the "last backup" timestamp). */
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  const last = latestBackup()
  if (!last) return NextResponse.json({ last: null })
  return NextResponse.json({
    last: { file: path.basename(last.file), bytes: last.bytes, mtime: last.mtime },
  })
}

/** POST → take a new backup now. */
export async function POST() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized. Admin or editor login required.' }, { status: 401 })
  }
  try {
    const { file, bytes } = backupDatabase()
    return NextResponse.json({ success: true, file: path.basename(file), bytes, mtime: new Date().toISOString() })
  } catch (err: any) {
    return NextResponse.json({ error: `Backup failed: ${err?.message ?? 'unknown error'}` }, { status: 500 })
  }
}
