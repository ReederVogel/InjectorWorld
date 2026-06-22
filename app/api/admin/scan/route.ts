import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdminOrEditor } from '@/lib/auth-guards'
import { runScan } from '@/lib/import/scan'
import { checkOrigin } from '@/lib/rate-limit'

export const runtime = 'nodejs'

/** Admin-only: run the DB-wide data-integrity scan (same as `npm run scan:alerts`). */
export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdminOrEditor(user)
  if (guard) return guard
  try {
    const res = await runScan(payload)
    return NextResponse.json({
      success: true,
      upserted: res.alerts.length,
      bySeverity: res.bySeverity,
      scanned: res.scanned,
    })
  } catch (err: any) {
    payload.logger.error(`[admin scan] ${err?.message ?? err}`)
    return NextResponse.json({ error: `Scan failed: ${err?.message ?? 'unknown error'}` }, { status: 500 })
  }
}
