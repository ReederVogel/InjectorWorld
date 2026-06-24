import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { RateLimiter, checkOrigin, getIp } from '@/lib/rate-limit'
import { verifyTurnstile } from '@/lib/captcha'
import {
  sendTransactional,
  adminRecipients,
  registerAdminEmail,
  registerConfirmEmail,
} from '@/lib/email-templates'

const limiter = new RateLimiter(5, 60 * 60 * 1000)

const ProviderSchema = z.object({
  role: z.literal('provider'),
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  licenseNumber: z.string().min(1, 'License number is required'),
  licenseState: z.string().length(2, 'Select a state'),
  cfTurnstileToken: z.string().optional(),
})

const ClinicSchema = z.object({
  role: z.literal('clinic'),
  name: z.string().min(1, 'Your name is required').max(200),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  clinicName: z.string().min(1, 'Clinic name is required').max(200),
  cfTurnstileToken: z.string().optional(),
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

    if (data.role === 'provider') {
      createData.name = `${safeName} [License: ${data.licenseState} ${data.licenseNumber}]`
    } else if (data.role === 'clinic') {
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
      licenseState: data.role === 'provider' ? data.licenseState : undefined,
      licenseNumber: data.role === 'provider' ? data.licenseNumber : undefined,
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
