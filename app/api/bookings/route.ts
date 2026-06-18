import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { RateLimiter, checkOrigin, getIp } from '@/lib/rate-limit'
import { verifyTurnstile } from '@/lib/captcha'

// 5 booking submissions per IP per hour.
const limiter = new RateLimiter(5, 60 * 60 * 1000)

const BookingSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Enter a valid email address'),
  phone: z.string().max(30).optional(),
  treatmentTag: z.string().max(100).optional(),
  preferredDate: z.string().optional(),
  message: z.string().max(2000).optional(),
  consentToContact: z.boolean().refine((v) => v === true, {
    message: 'You must consent to be contacted',
  }),
  providerId: z.string().min(1),
  clinicId: z.string().optional(),
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
    collection: 'bookings',
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
      { error: 'Too many requests. Please wait before submitting again.' },
      { status: 429 },
    )
  }

  // Parse + validate body
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = BookingSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as string
      if (key) fieldErrors[key] = issue.message
    }
    return NextResponse.json({ error: 'Validation failed.', fieldErrors }, { status: 422 })
  }

  const { firstName, lastName, email, phone, treatmentTag, preferredDate, message, providerId, clinicId, cfTurnstileToken } =
    parsed.data

  // HD1: Verify Turnstile CAPTCHA token to block automated booking spam.
  const captchaOk = await verifyTurnstile(cfTurnstileToken, getIp(req))
  if (!captchaOk) {
    return NextResponse.json({ error: 'CAPTCHA verification failed. Please try again.' }, { status: 400 })
  }

  const sanitize = (s: string) => (s ?? '').replace(/[\r\n\t]/g, ' ').trim()

  // Relationship IDs must be raw numbers for the Postgres adapter (locked rule).
  const providerIdNum = parseInt(providerId, 10)
  if (Number.isNaN(providerIdNum)) {
    return NextResponse.json({ error: 'Invalid provider reference.' }, { status: 400 })
  }
  const clinicIdNum = clinicId ? parseInt(clinicId, 10) : undefined

  const patientName = `${sanitize(firstName)} ${sanitize(lastName)}`.trim()

  // Save to Payload
  let bookingId: string | number
  let providerName = 'the provider'
  let clinicName = ''
  const payload = await getPayload({ config })
  try {

    // Resolve provider name for emails; also validate provider exists
    let prov: any = null
    try {
      prov = await payload.findByID({ collection: 'providers', id: providerId, depth: 1, overrideAccess: true })
      if (prov) providerName = (prov as any).fullName || providerName
    } catch {}
    if (!prov) {
      return NextResponse.json({ error: 'Invalid provider reference.' }, { status: 400 })
    }

    if (clinicId && clinicIdNum) {
      try {
        const clinic = await payload.findByID({ collection: 'clinics', id: clinicIdNum, depth: 0, overrideAccess: true })
        if (!clinic) {
          return NextResponse.json({ error: 'Invalid clinic reference.' }, { status: 400 })
        }
        // Verify clinic is actually linked to this provider
        const primaryClinicId = prov.clinic == null ? null : typeof prov.clinic === 'object' ? Number(prov.clinic.id) : Number(prov.clinic)
        const additionalIds: number[] = Array.isArray(prov.additionalClinics)
          ? prov.additionalClinics.map((c: any) => typeof c === 'object' ? Number(c.id) : Number(c))
          : []
        if (primaryClinicId !== clinicIdNum && !additionalIds.includes(clinicIdNum)) {
          return NextResponse.json({ error: 'Clinic is not associated with this provider.' }, { status: 400 })
        }
        clinicName = (clinic as any).clinicName || ''
      } catch {
        return NextResponse.json({ error: 'Could not validate clinic.' }, { status: 400 })
      }
    }

    // TODO: Add idempotency key (hash of provider+email+date) to prevent duplicate bookings on double-submit.
    const booking = await payload.create({
      collection: 'bookings',
      overrideAccess: true,
      data: {
        patientName,
        patientEmail: email,
        patientPhone: phone || undefined,
        provider: providerIdNum as any,
        clinic: clinicIdNum as any,
        treatmentTag: treatmentTag || undefined,
        preferredDate: preferredDate || undefined,
        message: message || undefined,
        consentToContact: true,
        status: 'new',
        source: 'provider_profile',
      } as any,
    })
    bookingId = booking.id
  } catch (err) {
    payload.logger.error(`[bookings] create failed: ${(err as Error)?.message}`)
    return NextResponse.json({ error: 'Unable to save your request. Please try again.' }, { status: 500 })
  }

  // Send emails via Resend (non-blocking — don't fail the request if email fails)
  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
    try {
      const { Resend } = await import('resend')
      const resend = new Resend(resendKey)
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'

      const sFirst = sanitize(firstName)
      const sProviderName = sanitize(providerName)
      const sClinicName = sanitize(clinicName)
      const sTreatmentTag = sanitize(treatmentTag || '')
      const sPreferredDate = sanitize(preferredDate || '')
      const sMessage = sanitize(message || '')
      const sEmail = sanitize(email)

      const patientEmailBody = `
Hi ${sFirst},

Your consultation request has been received.

Provider: ${sProviderName}
${sClinicName ? `Practice: ${sClinicName}` : ''}
Treatment: ${sTreatmentTag || 'General inquiry'}
${sPreferredDate ? `Preferred date: ${new Date(sPreferredDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}` : ''}
${sMessage ? `\nYour message:\n${sMessage}` : ''}

${sProviderName.split(' ')[0]} will be in touch within 24 hours.

This is not a confirmed appointment. Please wait for the provider to reach out to confirm.

injector.world
${siteUrl}
      `.trim()

      const adminEmailBody = `
New consultation request — Booking ID: ${bookingId}

Patient: ${patientName}
Email: ${sEmail}
${phone ? `Phone: ${phone}` : ''}

Provider: ${sProviderName}
${sClinicName ? `Practice: ${sClinicName}` : ''}
Treatment: ${sTreatmentTag || 'Not specified'}
${sPreferredDate ? `Preferred date: ${sPreferredDate}` : ''}
${sMessage ? `\nMessage:\n${sMessage}` : ''}

View in admin: ${siteUrl}/admin/collections/bookings/${bookingId}
      `.trim()

      const adminEmail = process.env.ADMIN_EMAIL
      if (!adminEmail && process.env.NODE_ENV === 'production') {
        console.error('[FATAL] ADMIN_EMAIL env var not set. Booking notifications will be lost.')
      }
      const toAdmin = adminEmail ?? 'admin@injector.world'

      await Promise.allSettled([
        resend.emails.send({
          from: 'bookings@injector.world',
          to: email,
          subject: `Your consultation request for ${sProviderName} — injector.world`,
          text: patientEmailBody,
        }),
        resend.emails.send({
          from: 'bookings@injector.world',
          to: toAdmin,
          subject: `New booking request: ${patientName} for ${sProviderName}`,
          text: adminEmailBody,
        }),
      ])
    } catch (emailErr) {
      console.error('[bookings] Resend failed:', emailErr)
      // Email failure is non-fatal — the booking was saved
    }
  } else {
    // Dev fallback: log to console
    console.log(`[bookings] New booking ${bookingId}: ${patientName} <${email}> → ${providerName}`)
    console.log(`[bookings] Treatment: ${treatmentTag || 'N/A'}, Date: ${preferredDate || 'N/A'}`)
    console.log('[bookings] Set RESEND_API_KEY to enable email notifications.')
  }

  return NextResponse.json({ success: true, bookingId: String(bookingId) })
}
