import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdminOrEditor } from '@/lib/auth-guards'
import { checkOrigin } from '@/lib/rate-limit'

export const runtime = 'nodejs'

/**
 * PATCH /api/admin/locations/quick-toggle
 * Toggle isLive and/or noindex for a location row.
 * Body: { locationId: number, isLive?: boolean, noindex?: boolean }
 * Auth: admin or editor.
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

  const { locationId, isLive, noindex } = body ?? {}

  if (!locationId) {
    return NextResponse.json({ error: 'locationId is required.' }, { status: 400 })
  }
  if (isLive === undefined && noindex === undefined) {
    return NextResponse.json({ error: 'Provide at least isLive or noindex.' }, { status: 400 })
  }

  try {
    const data: Record<string, boolean> = {}
    if (isLive !== undefined) data.isLive = Boolean(isLive)
    if (noindex !== undefined) data.noindex = Boolean(noindex)

    const updated = await payload.update({
      collection: 'locations',
      id: Number(locationId),
      data,
      overrideAccess: true,
    })

    const changedFields = Object.keys(data)
    const parts = changedFields.map((k) => `${k}=${data[k]}`).join(', ')

    await payload.create({
      collection: 'audit-logs',
      overrideAccess: true,
      data: {
        action: 'update',
        collectionSlug: 'locations',
        documentId: String(locationId),
        documentTitle: (updated as any).name ?? String(locationId),
        userEmail: user!.email || 'admin',
        userId: user!.id ? String(user!.id) : undefined,
        summary: `Market toggle: "${(updated as any).name}" → ${parts}`,
        changedFields,
      },
    })

    return NextResponse.json({
      id: (updated as any).id,
      isLive: (updated as any).isLive,
      noindex: (updated as any).noindex,
    })
  } catch (err: any) {
    payload.logger.error(`[quick-toggle] ${err?.message ?? err}`)
    return NextResponse.json({ error: err?.message ?? 'Update failed.' }, { status: 500 })
  }
}
