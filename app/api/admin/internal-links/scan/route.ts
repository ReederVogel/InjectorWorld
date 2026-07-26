import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdmin } from '@/lib/auth-guards'
import { checkOrigin } from '@/lib/rate-limit'
import { runDiscoveryBatch } from '@/lib/internal-links/discover'

export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * POST /api/admin/internal-links/scan
 * Body (optional): { limit?: number } -- how many not-yet-scanned guides/news
 * to process in this call (default 8, kept small to stay under serverless
 * request time limits). Each call is a bounded, resumable batch -- call
 * again (the admin "Scan" button does this in a loop) until `remaining` is 0.
 * Requires OPENROUTER_API_KEY to be set in the environment.
 * Auth: admin only.
 */
export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdmin(user)
  if (guard) return guard

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: 'OPENROUTER_API_KEY is not set on this environment.' }, { status: 500 })
  }

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    // no body is fine, use defaults
  }
  const limit = Math.min(Math.max(Number(body?.limit) || 8, 1), 25)

  try {
    const result = await runDiscoveryBatch(payload, limit)
    return NextResponse.json({ success: true, ...result })
  } catch (err: any) {
    payload.logger.error(`[internal-links/scan] ${err?.message ?? err}`)
    return NextResponse.json({ error: err?.message ?? 'Scan failed.' }, { status: 500 })
  }
}
