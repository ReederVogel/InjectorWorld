import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdmin } from '@/lib/auth-guards'
import { checkOrigin } from '@/lib/rate-limit'
import { runZipBackfill } from '@/lib/import/data-fix'

export const runtime = 'nodejs'

/**
 * POST /api/admin/data-fix/zip-backfill
 * Backfill city/state/lat/lng from zip_codes for clinics with bad data.
 * Body: { dryRun: boolean, confirmation?: string }
 * Confirmation phrase "FIX" required for real runs.
 * Auth: admin only.
 */
export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdmin(user)
  if (guard) return guard

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const dryRun = body?.dryRun !== false
  const confirmation = typeof body?.confirmation === 'string' ? body.confirmation.trim() : ''

  if (!dryRun && confirmation !== 'FIX') {
    return NextResponse.json(
      { error: 'Type exactly "FIX" in the confirmation field to apply.' },
      { status: 400 },
    )
  }

  try {
    const result = await runZipBackfill({ dryRun })

    if (!dryRun) {
      await payload.create({
        collection: 'audit-logs',
        overrideAccess: true,
        data: {
          action: 'update',
          collectionSlug: 'clinics',
          documentId: 'bulk',
          documentTitle: 'ZIP backfill (admin data-fix)',
          userEmail: user!.email || 'admin',
          userId: user!.id ? String(user!.id) : undefined,
          summary: `ZIP backfill applied: ${result.rowsAffected} clinic rows updated by ${user!.email}`,
        },
      })
    }

    return NextResponse.json({ success: true, ...result })
  } catch (err: any) {
    payload.logger.error(`[data-fix/zip-backfill] ${err?.message ?? err}`)
    return NextResponse.json({ error: err?.message ?? 'Fix failed.' }, { status: 500 })
  }
}
