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
 * to process in this call. Default 2, deliberately small: the admin UI loops
 * these calls, and a small batch is what makes its Stop button responsive
 * (a big batch can't be interrupted mid-flight) as well as keeping each
 * request well inside request time limits. Pages with the fewest incoming
 * links are processed first. Requires OPENROUTER_API_KEY in the environment.
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
  const limit = Math.min(Math.max(Number(body?.limit) || 2, 1), 10)

  try {
    const result = await runDiscoveryBatch(payload, limit)
    return NextResponse.json({ success: true, ...result })
  } catch (err: any) {
    payload.logger.error(`[internal-links/scan] ${err?.message ?? err}`)
    return NextResponse.json({ error: err?.message ?? 'Scan failed.' }, { status: 500 })
  }
}
