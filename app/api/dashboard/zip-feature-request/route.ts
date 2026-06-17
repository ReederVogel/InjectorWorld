import { NextRequest, NextResponse } from 'next/server'
import { getPayloadInstance } from '@/lib/payload-server'
import { getAuthUser } from '@/lib/auth-user'
import { RateLimiter, getIp } from '@/lib/rate-limit'

const limiter = new RateLimiter(5, 60 * 60 * 1000) // 5 requests per hour per IP

export async function POST(req: NextRequest) {
  if (!limiter.check(getIp(req))) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  const payload = await getPayloadInstance()
  const user = await getAuthUser(payload)
  if (!user || user.role !== 'provider') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { zip, radiusMiles, treatmentName, notes } = body

  // Validate ZIP.
  if (!zip || !/^\d{5}$/.test(String(zip))) {
    return NextResponse.json({ error: 'A valid 5-digit ZIP code is required.' }, { status: 400 })
  }

  // Validate radius.
  const radius = Number(radiusMiles)
  if (!Number.isFinite(radius) || radius < 1 || radius > 50) {
    return NextResponse.json({ error: 'Radius must be between 1 and 50 miles.' }, { status: 400 })
  }

  // Verify ZIP exists in zip_codes table.
  const pool = (payload.db as any).pool
  try {
    const hit = await pool.query(`SELECT city, state FROM zip_codes WHERE zip = $1 LIMIT 1`, [zip])
    if (!hit.rows.length) {
      return NextResponse.json(
        { error: `ZIP code ${zip} was not found in our dataset. Please double-check and try again.` },
        { status: 400 },
      )
    }
  } catch {
    // zip_codes table not seeded yet — allow the request through with a warning.
    console.warn('[zip-feature-request] zip_codes lookup failed; ZIP not validated.')
  }

  // Resolve the provider attached to this user.
  const providerRes = await payload.find({
    collection: 'providers',
    where: { claimedBy: { equals: user.id } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const provider = providerRes.docs[0] as any
  if (!provider) {
    return NextResponse.json({ error: 'No claimed provider profile found for your account.' }, { status: 404 })
  }

  const providerId = String(provider.id)
  const providerName = String(provider.fullName ?? 'Unknown')

  // Create a DataAlert for the admin to action.
  const alertKey = `zip-request-${providerId}-${zip}-${Date.now()}`
  const treatmentNote = treatmentName ? ` (treatment: ${treatmentName})` : ''
  const notesNote = notes ? ` Notes: ${notes}` : ''
  const message =
    `ZIP featuring request from ${providerName} (provider #${providerId}): ` +
    `ZIP ${zip}, radius ${radius} miles${treatmentNote}.${notesNote} ` +
    `Action: create a Promotion with scopeType 'zip' or 'treatment+zip', zipScope '${zip}', zipRadiusMiles ${radius}.`

  try {
    await payload.create({
      collection: 'data-alerts',
      data: {
        alertKey,
        type: 'zip_feature_request',
        severity: 'info',
        message,
        collectionSlug: 'providers',
        documentId: providerId,
        status: 'open',
      },
      overrideAccess: true,
    })
  } catch (err: any) {
    // If alertKey is somehow duplicate, that's fine (idempotent).
    if (!err?.message?.includes('unique')) {
      console.error('[zip-feature-request] Failed to create DataAlert:', err.message)
      return NextResponse.json({ error: 'Failed to submit request. Please try again.' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, message: 'Request submitted. The admin will review and set up your ZIP featuring.' })
}
