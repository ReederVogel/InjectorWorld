import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdminOrEditor } from '@/lib/auth-guards'
import { checkOrigin } from '@/lib/rate-limit'
import { serverError } from '@/lib/api-errors'

export const runtime = 'nodejs'

/**
 * PATCH /api/admin/qa/quick-answer
 * Post an answer to a reader question inline, without opening the full edit form.
 * Body: { id: number, answerText: string }
 * Auth: admin or editor.
 *
 * answeredByProvider/answeredByName describe whose answer it is (domain
 * content), not the logged-in operator, and neither is required — they stay
 * editable later in the full form if wanted. QA.ts's revalidateAfterChange
 * hook fires automatically on this PATCH, same as a manual save.
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

  const { id, answerText } = body ?? {}

  if (!id) {
    return NextResponse.json({ error: 'id is required.' }, { status: 400 })
  }
  if (typeof answerText !== 'string' || answerText.trim().length === 0) {
    return NextResponse.json({ error: 'answerText is required.' }, { status: 400 })
  }

  try {
    const updated = await payload.update({
      collection: 'qa',
      id: Number(id),
      data: { answerText: answerText.trim(), status: 'answered' },
      overrideAccess: true,
      user,
    })

    return NextResponse.json({
      id: (updated as any).id,
      status: (updated as any).status,
    })
  } catch (err: any) {
    payload.logger.error(`[qa/quick-answer] ${err?.message ?? err}`)
    return serverError('admin/qa/quick-answer', err, 'Update failed.')
  }
}
