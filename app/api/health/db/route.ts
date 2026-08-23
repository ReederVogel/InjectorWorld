import { NextResponse } from 'next/server'
import { getPayloadInstance } from '@/lib/payload-server'

export const dynamic = 'force-dynamic'

/**
 * DB-aware liveness check, for DigitalOcean's App Platform health check.
 *
 * The default TCP/HTTP health check DO ran against this app before 2026-08-19
 * only proves the Next.js process is listening -- it stayed "healthy" through
 * both DB pool wedges (2026-08-17, 2026-08-19) because non-DB routes kept
 * answering fine. This route exists to give DO something that actually fails
 * when the pool is wedged, so App Platform can restart the instance itself
 * instead of waiting for someone to notice.
 *
 * Runs a trivial query (SiteConfig global, depth 0) against a race with its
 * own timeout, so a wedged pool makes THIS route return 503 fast rather than
 * hang -- a health check that can itself hang forever defeats the point.
 */

const TIMEOUT_MS = 5_000

export async function GET() {
  const start = Date.now()

  try {
    const payload = await getPayloadInstance()
    await Promise.race([
      payload.findGlobal({ slug: 'site-config', depth: 0 }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('db health check timed out')), TIMEOUT_MS),
      ),
    ])

    return NextResponse.json({ ok: true, ms: Date.now() - start })
  } catch (err) {
    console.error('[health/db] failed', err instanceof Error ? err.message : err)
    return NextResponse.json({ ok: false, ms: Date.now() - start }, { status: 503 })
  }
}
