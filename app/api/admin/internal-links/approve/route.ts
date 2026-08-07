import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdmin } from '@/lib/auth-guards'
import { checkOrigin } from '@/lib/rate-limit'
import { serverError } from '@/lib/api-errors'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * POST /api/admin/internal-links/approve
 * Body: { id: number, status?: 'approved' | 'rejected' }
 *
 * Sets a single link suggestion's status, which fires the collection's
 * afterChange hook -- that is what actually inserts (or removes) the inline
 * link in the source Guide/News body and bumps its updatedAt.
 *
 * Deliberately one suggestion per request: the insertion is a read-modify-write
 * on the source body, and firing several at once contends for both the doc lock
 * and the small DB connection pool. The admin UI calls this per click.
 *
 * Auth: admin only.
 */
export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdmin(user)
  if (guard) return guard

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  const id = Number(body?.id)
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'A numeric suggestion id is required.' }, { status: 400 })
  }
  const status = body?.status === 'rejected' ? 'rejected' : 'approved'

  try {
    await payload.update({
      collection: 'internal-link-suggestions',
      id,
      data: { status } as any,
      overrideAccess: true,
    })

    // Re-read so the response reflects what the hook actually did: it records
    // insertedAt on success, or errorMessage when the anchor text no longer
    // matches the live body (content edited since the suggestion was made).
    const after = (await payload.findByID({
      collection: 'internal-link-suggestions',
      id,
      depth: 0,
      overrideAccess: true,
    })) as any

    if (status === 'approved' && after?.errorMessage) {
      return NextResponse.json(
        { success: false, error: after.errorMessage, status: after.status },
        { status: 409 },
      )
    }

    return NextResponse.json({
      success: true,
      status: after?.status ?? status,
      insertedAt: after?.insertedAt ?? null,
    })
  } catch (err: any) {
    payload.logger.error(`[internal-links/approve] ${err?.message ?? err}`)
    return serverError('admin/internal-links/approve', err, 'Approve failed.')
  }
}
