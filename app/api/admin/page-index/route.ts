import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdminOrEditor } from '@/lib/auth-guards'
import { checkOrigin } from '@/lib/rate-limit'

export const runtime = 'nodejs'

/** GET: list unacknowledged "new page" notifications (and a total count). */
export async function GET(req: NextRequest) {
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdminOrEditor(user)
  if (guard) return guard

  const res = await payload.find({
    collection: 'page-index' as any,
    where: { acknowledged: { equals: false } },
    sort: '-dataCount',
    limit: 50,
    depth: 0,
  })
  const totals = await payload.find({ collection: 'page-index' as any, where: { indexed: { equals: true } }, limit: 0, depth: 0 })
  return NextResponse.json({
    success: true,
    pending: (res.docs as any[]).map((r) => ({
      id: r.id, path: r.path, pageType: r.pageType, dataCount: r.dataCount, indexed: r.indexed,
    })),
    pendingCount: res.totalDocs,
    indexedCount: totals.totalDocs,
  })
}

/**
 * PATCH: act on a page from the dashboard notification.
 * Body: { id, action: 'keep' | 'noindex' | 'index' }
 *  - keep    → acknowledge, leave indexMode auto (stays indexed while it has data)
 *  - noindex → force-noindex + acknowledge
 *  - index   → force-index + acknowledge
 */
export async function PATCH(req: NextRequest) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdminOrEditor(user)
  if (guard) return guard

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }) }
  const id = body?.id
  const action = body?.action
  if (!id || !['keep', 'noindex', 'index'].includes(action)) {
    return NextResponse.json({ error: 'Provide id and action (keep | noindex | index).' }, { status: 400 })
  }

  const indexMode = action === 'noindex' ? 'force-noindex' : action === 'index' ? 'force-index' : 'auto'
  try {
    await payload.update({
      collection: 'page-index' as any, id, overrideAccess: true,
      data: { acknowledged: true, indexMode },
    })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Update failed.' }, { status: 500 })
  }
}
