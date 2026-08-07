import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { runWipe, type WipeScope } from '@/lib/import/wipe'
import { backupDatabase } from '@/lib/db-backup-core'
import { checkOrigin } from '@/lib/rate-limit'
import { requireAdmin } from '@/lib/auth-guards'
import { serverError } from '@/lib/api-errors'
import path from 'node:path'

export const runtime = 'nodejs'

/**
 * Admin-only scoped data wipe (launch-day fake → real swap).
 * Body (JSON): { scope: 'directory'|'state', state?: 'CA', dryRun?: boolean, confirm?: string }
 *
 * A real wipe (dryRun !== true) requires:
 *   - admin role
 *   - confirm === 'WIPE DIRECTORY'  (directory scope)
 *     or confirm === 'WIPE STATE <CODE>'  (state scope)
 *   - a successful automatic backup (no backup → no wipe)
 */
export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const payload = await getPayload({ config })

  const user = await getAuthUser(payload)
  // Wipe is destructive: admin only (stricter than import, which allows editors).
  const guard = requireAdmin(user)
  if (guard) return guard

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  const scope = (body.scope ?? 'directory') as WipeScope
  const state: string | undefined = body.state ? String(body.state).toUpperCase() : undefined
  const dryRun = body.dryRun === true
  const confirm = typeof body.confirm === 'string' ? body.confirm.trim() : ''

  if (scope !== 'directory' && scope !== 'state') {
    return NextResponse.json({ error: 'Invalid scope. Use "directory" or "state".' }, { status: 400 })
  }
  if (scope === 'state' && !state) {
    return NextResponse.json({ error: 'A state code is required for a by-state wipe.' }, { status: 400 })
  }

  // Real wipe gate: typed phrase.
  if (!dryRun) {
    const expected = scope === 'directory' ? 'WIPE DIRECTORY' : `WIPE STATE ${state}`
    if (confirm !== expected) {
      return NextResponse.json(
        { error: `Confirmation phrase mismatch. Type exactly: ${expected}` },
        { status: 400 },
      )
    }
  }

  let backupFile: string | undefined
  if (!dryRun) {
    try {
      const { file: backupFileLocal, r2Url: backupR2Url } = await backupDatabase()
      backupFile = backupFileLocal
      console.log('[BACKUP] URL:', backupR2Url)
    } catch (err: any) {
      // The reassurance ("no data was deleted") stays in the public message,
      // because that is the one thing the operator most needs to know here. The
      // cause goes to the log with a ref, like every other 500 in the app.
      return serverError(
        'admin/wipe:backup',
        err,
        'Auto-backup failed, so the wipe was aborted. No data was deleted.',
      )
    }
  }

  try {
    const result = await runWipe(payload, { scope, state, dryRun, actorEmail: user!.email })
    if (!dryRun) {
      try { revalidatePath('/', 'layout') } catch { /* no-op outside request */ }
    }
    // L1: return only the filename, not the full local filesystem path.
    const backupBasename = backupFile ? path.basename(backupFile) : undefined
    return NextResponse.json({ success: true, result, backupFile: backupBasename })
  } catch (err: any) {
    // `backupFile` is an absolute path on the server disk. The success path
    // above already reduces it to path.basename() for exactly that reason; this
    // branch was still returning the full path, so the one place a filesystem
    // layout leaked was the error case. It now goes to the log only.
    payload.logger.error(`[admin wipe] failed after backup at ${backupFile ?? '(none)'}`)
    return serverError(
      'admin/wipe',
      err,
      backupFile
        ? 'Wipe failed. A backup was taken first, and its name is in the server log.'
        : 'Wipe failed.',
    )
  }
}
