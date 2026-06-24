import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { RateLimiter, checkOrigin, getIp } from '@/lib/rate-limit'
import { verifyTurnstile } from '@/lib/captcha'
import { sendTransactional, adminRecipients, claimAdminEmail } from '@/lib/email-templates'

// 3 claim submissions per IP per hour.
const limiter = new RateLimiter(3, 60 * 60 * 1000)

const ClaimSchema = z.object({
  claimType: z.enum(['provider', 'clinic']),
  targetId: z.string().min(1, 'Target ID is required'),
  claimantName: z.string().min(1, 'Name is required').max(200),
  claimantEmail: z.string().email('Enter a valid email address'),
  claimantPhone: z.string().max(30).optional(),
  roleAtPractice: z.string().min(1, 'Your role at the practice is required').max(100),
  licenseNumber: z.string().max(100).optional(),
  npiNumber: z.string().max(20).optional(),
  businessProof: z.string().max(500).optional(),
  message: z.string().max(2000).optional(),
  cfTurnstileToken: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || (user.role !== 'admin' && user.role !== 'editor')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const status = url.searchParams.get('where[status][equals]')
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '10', 10), 100)
  const sort = url.searchParams.get('sort') ?? '-createdAt'
  const depth = parseInt(url.searchParams.get('depth') ?? '0', 10)

  const result = await payload.find({
    collection: 'claims',
    where: status ? { status: { equals: status } } : {},
    limit,
    sort,
    depth,
    overrideAccess: true,
  })

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }
  if (!limiter.check(getIp(req))) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before submitting another claim.' },
      { status: 429 },
    )
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  // Honeypot: bots fill hidden fields; humans leave them empty.
  if ((raw as any)?.website) {
    return NextResponse.json({ success: true })
  }

  const parsed = ClaimSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as string
      if (key) fieldErrors[key] = issue.message
    }
    return NextResponse.json({ error: 'Validation failed.', fieldErrors }, { status: 422 })
  }

  const {
    claimType,
    targetId,
    claimantName,
    claimantEmail,
    claimantPhone,
    roleAtPractice,
    licenseNumber,
    npiNumber,
    businessProof,
    message,
    cfTurnstileToken,
  } = parsed.data

  // HD1: Verify Turnstile CAPTCHA to block automated claim submissions.
  const captchaOk = await verifyTurnstile(cfTurnstileToken, getIp(req))
  if (!captchaOk) {
    return NextResponse.json({ error: 'CAPTCHA verification failed. Please try again.' }, { status: 400 })
  }

  // Relationship IDs must be raw numbers for the Postgres adapter (locked rule).
  // The form sends targetId as a string, so coerce it here or the claim create
  // fails validation ("Target Provider invalid").
  const targetIdNum = parseInt(targetId, 10)
  if (Number.isNaN(targetIdNum)) {
    return NextResponse.json({ error: 'Invalid profile reference.' }, { status: 400 })
  }

  const payload = await getPayload({ config })

  // Verify the target exists and is not already claimed
  try {
    const targetCollection = claimType === 'provider' ? 'providers' : 'clinics'
    const target = await payload.findByID({
      collection: targetCollection,
      id: targetId,
      depth: 0,
      overrideAccess: true,
    })
    if (!target) {
      console.log('[claims] target not found:', claimType, targetId)
      return NextResponse.json({ success: true, message: 'If a matching profile was found, your claim has been submitted for review.' })
    }
    if ((target as any).claimed) {
      return NextResponse.json(
        { error: 'This profile has already been claimed.' },
        { status: 409 },
      )
    }
  } catch {
    console.log('[claims] lookup failed:', claimType, targetId)
    return NextResponse.json({ success: true, message: 'If a matching profile was found, your claim has been submitted for review.' })
  }

  // Create the claim record
  try {
    const claimData: Record<string, unknown> = {
      claimType,
      claimantName,
      claimantEmail,
      claimantPhone: claimantPhone || undefined,
      roleAtPractice,
      licenseNumber: licenseNumber || undefined,
      npiNumber: npiNumber || undefined,
      businessProof: businessProof || undefined,
      message: message || undefined,
      status: 'new',
    }
    if (claimType === 'provider') claimData.targetProvider = targetIdNum
    else claimData.targetClinic = targetIdNum

    const created = await payload.create({
      collection: 'claims',
      data: claimData as any,
      overrideAccess: true,
    })

    // Notify admin + founder of the new claim (non-blocking)
    const targetName = claimType === 'provider'
      ? (await payload.findByID({ collection: 'providers', id: targetId, depth: 0, overrideAccess: true }).catch(() => null) as any)?.fullName || `Provider #${targetId}`
      : (await payload.findByID({ collection: 'clinics', id: targetId, depth: 0, overrideAccess: true }).catch(() => null) as any)?.clinicName || `Clinic #${targetId}`

    void sendTransactional({
      to: adminRecipients(),
      subject: `New ${claimType} claim: ${claimantName}`,
      ...claimAdminEmail({
        claimantName,
        claimantEmail,
        claimantPhone: claimantPhone || '',
        claimType,
        targetName,
        roleAtPractice,
        licenseNumber: licenseNumber || '',
        npiNumber: npiNumber || '',
        message: message || '',
        claimId: created.id,
      }),
      tag: 'claim-admin',
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[claims] create failed:', err)
    return NextResponse.json(
      { error: 'Could not submit your claim. Please try again.' },
      { status: 500 },
    )
  }
}
