import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { RateLimiter, checkOrigin, getIp } from '@/lib/rate-limit'

const limiter = new RateLimiter(5, 60 * 60 * 1000)

const ProviderSchema = z.object({
  role: z.literal('provider'),
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  licenseNumber: z.string().min(1, 'License number is required'),
  licenseState: z.string().length(2, 'Select a state'),
})

const ClinicSchema = z.object({
  role: z.literal('clinic'),
  name: z.string().min(1, 'Your name is required').max(200),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  clinicName: z.string().min(1, 'Clinic name is required').max(200),
})

const RegisterSchema = z.discriminatedUnion('role', [ProviderSchema, ClinicSchema])

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }
  if (!limiter.check(getIp(req))) {
    return NextResponse.json(
      { error: 'Too many registration attempts. Please wait and try again.' },
      { status: 429 },
    )
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = RegisterSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Validation failed.' },
      { status: 422 },
    )
  }

  const data = parsed.data
  const payload = await getPayload({ config })

  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: data.email } },
    limit: 1,
    overrideAccess: true,
  })
  if (existing.docs.length > 0) {
    // Non-revealing response (same as signup route)
    return NextResponse.json({ success: true })
  }

  const safeName = data.name.replace(/[\r\n]/g, ' ').trim()

  try {
    const createData: Record<string, unknown> = {
      name: safeName,
      email: data.email,
      password: data.password,
      role: data.role,
    }

    if (data.role === 'provider') {
      // Store license info in a note field for admin review (no DB change needed)
      // Admin will verify and link linkedProvider on claim approval
      createData.name = `${safeName} [License: ${data.licenseState} ${data.licenseNumber}]`
    } else if (data.role === 'clinic') {
      createData.name = `${safeName} [Clinic: ${data.clinicName}]`
    }

    await payload.create({
      collection: 'users',
      data: createData as never,
      overrideAccess: true,
    })

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'
    // Phase G will send a real verification email; for now, log the intent.
    console.log(`[register] New ${data.role} registration: ${data.email} — awaiting admin review.`)
    console.log(`[register] Admin link: ${siteUrl}/admin/collections/users`)
  } catch (err) {
    payload.logger.error(`[auth/register] create failed: ${(err as Error)?.message}`)
    return NextResponse.json(
      { error: 'Could not create your account. Please try again.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ success: true })
}
