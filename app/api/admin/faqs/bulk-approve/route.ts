import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdmin } from '@/lib/auth-guards'
import { checkOrigin } from '@/lib/rate-limit'
import { approveFaqUpload } from '@/lib/import/faqs-bulk-upload'

export const runtime = 'nodejs'

function normalizeIds(value: unknown): number[] {
  const raw = Array.isArray(value) ? value : value == null ? [] : [value]
  return raw
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0)
}

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

  const batch = typeof body?.batch === 'string' && body.batch.trim() ? body.batch.trim() : undefined
  const ids = normalizeIds(body?.ids ?? body?.id)
  if (!batch && ids.length === 0) {
    return NextResponse.json({ error: 'Provide batch or ids.' }, { status: 400 })
  }

  try {
    const result = await approveFaqUpload(payload, { batch, ids: ids.length ? ids : undefined })
    return NextResponse.json({ success: true, ...result })
  } catch (err: any) {
    payload.logger.error(`[faqs bulk approve] ${err?.message ?? err}`)
    return NextResponse.json({ error: `Approve failed: ${err?.message ?? 'unknown error'}` }, { status: 500 })
  }
}
