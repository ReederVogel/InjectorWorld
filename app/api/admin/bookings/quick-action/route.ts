import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdminOrEditor } from '@/lib/auth-guards'
import { checkOrigin } from '@/lib/rate-limit'
import { serverError } from '@/lib/api-errors'

export const runtime = 'nodejs'

const ACTION_TO_STATUS: Record<string, 'confirmed' | 'cancelled'> = {
  confirm: 'confirmed',
  cancel: 'cancelled',
}

/**
 * PATCH /api/admin/bookings/quick-action
 * One-click confirm/cancel for a new lead, without opening the full edit form.
 * Body: { id: number, action: 'confirm' | 'cancel' }
 * Auth: admin or editor.
 *
 * 'completed' / 'no_show' are post-appointment bookkeeping, not urgent
 * triage — those stay in the full form, only the two whitelisted here.
 */
export async function PATCH(req: NextRequest) {
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

  const { id, action } = body ?? {}
  const status = ACTION_TO_STATUS[action]

  if (!id) {
    return NextResponse.json({ error: 'id is required.' }, { status: 400 })
  }
  if (!status) {
    return NextResponse.json({ error: 'action must be "confirm" or "cancel".' }, { status: 400 })
  }

  try {
    const updated = await payload.update({
      collection: 'bookings',
      id: Number(id),
      data: { status },
      overrideAccess: true,
      user,
    })

    return NextResponse.json({
      id: (updated as any).id,
      status: (updated as any).status,
    })
  } catch (err: any) {
    payload.logger.error(`[bookings/quick-action] ${err?.message ?? err}`)
    return serverError('admin/bookings/quick-action', err, 'Update failed.')
  }
}
