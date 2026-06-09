import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { runWipe, type WipeScope } from '@/lib/import/wipe'
import { backupDatabase } from '@/lib/db-backup-core'

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
  const payload = await getPayload({ config })

  const user = await getAuthUser(payload)
  // Wipe is destructive: admin only (stricter than import, which allows editors).
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized. Admin login required.' }, { status: 401 })
  }

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
      backupFile = backupDatabase().file
    } catch (err: any) {
      return NextResponse.json(
        { error: `Auto-backup failed, wipe aborted (no data was deleted): ${err?.message ?? err}` },
        { status: 500 },
      )
    }
  }

  try {
    const result = await runWipe(payload, { scope, state, dryRun, actorEmail: user.email })
    if (!dryRun) {
      try { revalidatePath('/', 'layout') } catch { /* no-op outside request */ }
    }
    return NextResponse.json({ success: true, result, backupFile })
  } catch (err: any) {
    payload.logger.error(`[admin wipe] ${err?.message ?? err}`)
    return NextResponse.json(
      { error: `Wipe failed: ${err?.message ?? 'unknown error'}${backupFile ? ` (backup at ${backupFile})` : ''}` },
      { status: 500 },
    )
  }
}
