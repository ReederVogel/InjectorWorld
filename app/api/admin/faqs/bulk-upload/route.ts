import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdmin } from '@/lib/auth-guards'
import { checkOrigin } from '@/lib/rate-limit'
import { stageFaqUpload } from '@/lib/import/faqs-bulk-upload'

export const runtime = 'nodejs'

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

  try {
    const report = await stageFaqUpload(payload, body?.faqs ?? body, {
      batch: typeof body?.batch === 'string' ? body.batch : undefined,
    })
    return NextResponse.json({ success: true, report })
  } catch (err: any) {
    payload.logger.error(`[faqs bulk upload] ${err?.message ?? err}`)
    return NextResponse.json({ error: `Upload failed: ${err?.message ?? 'unknown error'}` }, { status: 500 })
  }
}
