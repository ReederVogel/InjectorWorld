import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { RateLimiter, checkOrigin, getIp } from '@/lib/rate-limit'
import { verifyTurnstile } from '@/lib/captcha'
import { getAuthUser } from '@/lib/auth-user'
import {
  sendTransactional,
  adminRecipients,
  registerAdminEmail,
  registerConfirmEmail,
} from '@/lib/email-templates'

const limiter = new RateLimiter(5, 60 * 60 * 1000)

const ClinicSchema = z.object({
  role: z.literal('clinic'),
  name: z.string().min(1, 'Your name is required').max(200),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  clinicName: z.string().min(1, 'Clinic name is required').max(200),
  cfTurnstileToken: z.string().optional(),
})

const RegisterSchema = ClinicSchema

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }
  if (!(await limiter.check(getIp(req)))) {
    return NextResponse.json(
      { error: 'Too many registration attempts. Please wait and try again.' },
      { status: 429 },
    )
  }

  // An authenticated caller must not be able to open a second account. The
  // /register page redirects signed-in visitors away, but that is only UI —
  // this is the check that actually holds.
  {
    const payload = await getPayload({ config })
    const existingSession = await getAuthUser(payload)
    if (existingSession) {
      return NextResponse.json(
        { error: 'You are already signed in. Sign out first to register a different account.' },
        { status: 409 },
      )
    }
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

  const parsed = RegisterSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Validation failed.' },
      { status: 422 },
    )
  }

  const data = parsed.data

  const captchaOk = await verifyTurnstile(data.cfTurnstileToken, getIp(req))
  if (!captchaOk) {
    return NextResponse.json({ error: 'CAPTCHA verification failed. Please try again.' }, { status: 400 })
  }

  const payload = await getPayload({ config })

  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: data.email } },
    limit: 1,
    overrideAccess: true,
  })
  if (existing.docs.length > 0) {
    // Non-revealing response
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

    if (data.role === 'clinic') {
      createData.name = `${safeName} [Clinic: ${data.clinicName}]`
    }

    await payload.create({
      collection: 'users',
      data: createData as never,
      overrideAccess: true,
    })
  } catch (err) {
    payload.logger.error(`[auth/register] create failed: ${(err as Error)?.message}`)
    return NextResponse.json(
      { error: 'Could not create your account. Please try again.' },
      { status: 500 },
    )
  }

  // Notify admin + founder (non-blocking)
  void sendTransactional({
    to: adminRecipients(),
    subject: `New ${data.role} application: ${safeName}`,
    ...registerAdminEmail({
      applicantName: safeName,
      applicantEmail: data.email,
      role: data.role,
      clinicName: data.role === 'clinic' ? data.clinicName : undefined,
    }),
    tag: 'register-admin',
  })

  // Confirm receipt to the applicant (non-blocking)
  void sendTransactional({
    to: data.email,
    subject: 'Application received — injector.world',
    ...registerConfirmEmail({ applicantFirstName: safeName.split(' ')[0] || safeName, role: data.role }),
    tag: 'register-confirm',
  })

  return NextResponse.json({ success: true })
}
