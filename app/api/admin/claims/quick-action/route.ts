import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdminOrEditor } from '@/lib/auth-guards'
import { checkOrigin } from '@/lib/rate-limit'

export const runtime = 'nodejs'

const ACTION_TO_STATUS: Record<string, 'approved' | 'rejected'> = {
  approve: 'approved',
  reject: 'rejected',
}

/**
 * PATCH /api/admin/claims/quick-action
 * One-click approve/reject for a claim, without opening the full edit form.
 * Body: { id: number, action: 'approve' | 'reject' }
 * Auth: admin or editor.
 *
 * Just PATCHes `status` via the local API — Claims.ts's approveClaimHook
 * (afterChange, keyed off status -> 'approved') does all the real work
 * (create/link the user account, mark the profile claimed, send the email)
 * exactly as it would from a manual form save. Nothing here duplicates that.
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
    return NextResponse.json({ error: 'action must be "approve" or "reject".' }, { status: 400 })
  }

  try {
    const updated = await payload.update({
      collection: 'claims',
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
    payload.logger.error(`[claims/quick-action] ${err?.message ?? err}`)
    return NextResponse.json({ error: err?.message ?? 'Update failed.' }, { status: 500 })
  }
}
