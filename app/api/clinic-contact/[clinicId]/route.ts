import { type NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { RateLimiter, getIp } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * Reveals a clinic's phone and email to a signed-in visitor.
 *
 * The login gate was the only control here, and a login gate alone does not stop
 * harvesting: one account plus a loop over clinic IDs walks the entire directory.
 * With ~40k clinics that is minutes of work for a complete contact list.
 *
 * The limiter below is therefore keyed on the USER, not the IP. Keying on IP
 * would be the wrong control for this specific route — rotating addresses is
 * trivial and free, whereas the account is the thing an enumerator has to keep
 * and the thing that can be banned afterwards. IP is used only as a fallback for
 * the unreachable case where a user record has no usable id.
 *
 * 30/minute is far above what the UI can generate (one reveal per clinic page
 * the visitor actually opens) and far below what a scraper needs.
 */
const limiter = new RateLimiter(30, 60 * 1000)

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clinicId: string }> },
) {
  const { clinicId } = await params
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const limitKey = `clinic-contact:${(user as { id?: string | number }).id ?? getIp(req)}`
  if (!(await limiter.check(limitKey))) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } },
    )
  }

  // Reject anything that is not a plain positive integer before it reaches the
  // database. Payload would throw on a malformed id and land in the catch below
  // anyway, but failing here keeps a junk id from costing a query.
  if (!/^\d+$/.test(clinicId)) {
    return NextResponse.json(
      { error: 'Not found' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  try {
    const clinic = await payload.findByID({
      collection: 'clinics',
      id: clinicId,
      depth: 0,
    })
    return NextResponse.json(
      {
        phone: (clinic as { phone?: string | null }).phone ?? null,
        email: (clinic as { email?: string | null }).email ?? null,
      },
      {
        // This response is per-clinic and only for signed-in callers, so it must
        // never be stored by a CDN or shared proxy. Cloudflare happens to bypass
        // caching for this path today, which means the absence of this header was
        // never visible — that is luck, not design, and one cache rule change
        // away from serving one visitor's reveal to everyone.
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  } catch {
    return NextResponse.json(
      { error: 'Not found' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
