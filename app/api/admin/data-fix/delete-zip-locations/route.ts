import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdmin } from '@/lib/auth-guards'
import { checkOrigin } from '@/lib/rate-limit'
import { runDeleteZipLocations } from '@/lib/import/data-fix'

export const runtime = 'nodejs'

/**
 * POST /api/admin/data-fix/delete-zip-locations
 * Delete fake metro/city locations created from ZIP codes (e.g. "CA 90004", "90004").
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
    const result = await runDeleteZipLocations({ dryRun })

    if (!dryRun) {
      await payload.create({
        collection: 'audit-logs',
        overrideAccess: true,
        data: {
          action: 'delete',
          collectionSlug: 'locations',
          documentId: 'bulk',
          documentTitle: 'Delete ZIP-only locations (admin data-fix)',
          userEmail: user!.email || 'admin',
          userId: user!.id ? String(user!.id) : undefined,
          summary: `ZIP-only locations deleted: ${result.rowsAffected} rows by ${user!.email}`,
        },
      })
    }

    return NextResponse.json({ success: true, ...result })
  } catch (err: any) {
    payload.logger.error(`[data-fix/delete-zip-locations] ${err?.message ?? err}`)
    return NextResponse.json({ error: err?.message ?? 'Fix failed.' }, { status: 500 })
  }
}
