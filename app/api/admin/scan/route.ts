import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { runScan } from '@/lib/import/scan'

export const runtime = 'nodejs'

/** Admin-only: run the DB-wide data-integrity scan (same as `npm run scan:alerts`). */
export async function POST() {
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  if (!user || (user.role !== 'admin' && user.role !== 'editor')) {
    return NextResponse.json({ error: 'Unauthorized. Admin or editor login required.' }, { status: 401 })
  }
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
