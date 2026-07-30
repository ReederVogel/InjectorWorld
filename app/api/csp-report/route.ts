import { NextRequest, NextResponse } from 'next/server'
import { RateLimiter, getIp } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * CSP violation collector.
 *
 * Only receives traffic when CSP_REPORT_ONLY=true, which ships a stricter
 * Content-Security-Policy-Report-Only header alongside the enforced policy (see
 * the long note in next.config.mjs). Reports land in the DigitalOcean app logs,
 * where they answer one question: would dropping 'unsafe-inline' from
 * script-src break anything real?
 *
 * Deliberately writes nothing to the database. This endpoint is public and
 * unauthenticated by necessity (browsers send reports without credentials), so
 * a database write here would be an unauthenticated write path. Logging keeps
 * the blast radius at "noisy logs".
 *
 * Always answers 204, even on malformed input. A collector that errors would
 * just generate more browser noise.
 */

// Violations arrive in bursts (one per blocked resource per page load), so the
// cap is well above the per-page count but still bounds log spam from abuse.
const limiter = new RateLimiter(60, 60 * 1000)

const MAX_BODY_BYTES = 8 * 1024

export async function POST(req: NextRequest) {
  try {
    if (!(await limiter.check(`csp:${getIp(req)}`))) {
      return new NextResponse(null, { status: 204 })
    }

    const raw = await req.text()
    if (!raw || raw.length > MAX_BODY_BYTES) {
      return new NextResponse(null, { status: 204 })
    }

    let parsed: any
    try {
      parsed = JSON.parse(raw)
    } catch {
      return new NextResponse(null, { status: 204 })
    }

    // Browsers send either the legacy {"csp-report": {...}} shape (report-uri)
    // or a bare report body. Accept both.
    const r = parsed['csp-report'] ?? parsed
    console.warn('[csp-report]', {
      violatedDirective: r['violated-directive'] ?? r.violatedDirective ?? null,
      blockedUri: r['blocked-uri'] ?? r.blockedURI ?? null,
      documentUri: r['document-uri'] ?? r.documentURL ?? null,
      // First 200 chars only: the full sample can be large and may contain
      // page content.
      sample: typeof r['script-sample'] === 'string' ? r['script-sample'].slice(0, 200) : null,
    })
  } catch {
    // Never surface an error to the browser's reporting pipeline.
  }

  return new NextResponse(null, { status: 204 })
}
