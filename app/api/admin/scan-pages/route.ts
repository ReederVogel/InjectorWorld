import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdminOrEditor } from '@/lib/auth-guards'
import { scanPages } from '@/lib/page-index/scan-pages'
import { checkOrigin } from '@/lib/rate-limit'

export const runtime = 'nodejs'

/** Admin-only: scan clinic data and refresh the page-index (same as `npm run scan:pages`). */
export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdminOrEditor(user)
  if (guard) return guard
  try {
    const res = await scanPages(payload)
    return NextResponse.json({ success: true, ...res })
  } catch (err: any) {
    payload.logger.error(`[admin scan-pages] ${err?.message ?? err}`)
    return NextResponse.json({ error: `Page scan failed: ${err?.message ?? 'unknown error'}` }, { status: 500 })
  }
}
