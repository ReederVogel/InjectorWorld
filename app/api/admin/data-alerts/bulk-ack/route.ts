import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdminOrEditor } from '@/lib/auth-guards'
import { checkOrigin } from '@/lib/rate-limit'

export const runtime = 'nodejs'

/**
 * POST /api/admin/data-alerts/bulk-ack
 * Bulk-acknowledge every open data alert of a given type, for the DataAlerts
 * list header's "Bulk acknowledge by type" control.
 * Body: { type: string }
 * Auth: admin or editor.
 */
export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdminOrEditor(user)
  if (guard) return guard

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { type } = body ?? {}
  if (!type || typeof type !== 'string') {
    return NextResponse.json({ error: 'type is required and must be a string.' }, { status: 400 })
  }

  try {
    const result = await payload.update({
      collection: 'data-alerts',
      where: { type: { equals: type }, status: { equals: 'open' } },
      data: { status: 'acknowledged' },
      overrideAccess: true,
      user,
    })

    return NextResponse.json({ updated: result.docs.length })
  } catch (err: any) {
    payload.logger.error(`[data-alerts/bulk-ack] ${err?.message ?? err}`)
    return NextResponse.json({ error: err?.message ?? 'Bulk acknowledge failed.' }, { status: 500 })
  }
}
