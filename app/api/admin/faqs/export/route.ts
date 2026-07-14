import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdmin } from '@/lib/auth-guards'
import { exportAllFaqs } from '@/lib/import/faqs-bulk-upload'

export const runtime = 'nodejs'

// GET (not POST): a plain browser navigation / download click, not a fetch()
// with a JSON body, so this isn't gated by checkOrigin the way the write
// routes are -- it's a read-only export, protected by the admin session cookie.
export async function GET(req: NextRequest) {
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdmin(user)
  if (guard) return guard

  try {
    const faqs = await exportAllFaqs(payload)
    const body = JSON.stringify({ exportedAt: new Date().toISOString(), total: faqs.length, faqs }, null, 2)
    const stamp = new Date().toISOString().slice(0, 10)
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="faqs-export-${stamp}.json"`,
      },
    })
  } catch (err: any) {
    payload.logger.error(`[faqs export] ${err?.message ?? err}`)
    return NextResponse.json({ error: `Export failed: ${err?.message ?? 'unknown error'}` }, { status: 500 })
  }
}
