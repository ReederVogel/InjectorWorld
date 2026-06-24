import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { RateLimiter, checkOrigin, getIp } from '@/lib/rate-limit'
import { verifyTurnstile } from '@/lib/captcha'
import {
  sendTransactional,
  adminRecipients,
  bookingPatientEmail,
  bookingProviderEmail,
  bookingAdminEmail,
} from '@/lib/email-templates'

// 3 booking submissions per IP per hour.
const limiter = new RateLimiter(3, 60 * 60 * 1000)

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

  // Honeypot: bots fill hidden fields; humans leave them empty.
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  if ((raw as any)?.website) {
    return NextResponse.json({ success: true })
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

  const payload = await getPayload({ config })
  let bookingId: string | number
  let providerName = 'the provider'
  let clinicName = ''
  let providerUserEmail: string | null = null

  try {
    // Resolve provider + validate it exists
    let prov: any = null
    try {
      prov = await payload.findByID({ collection: 'providers', id: providerId, depth: 1, overrideAccess: true })
      if (prov) providerName = (prov as any).fullName || providerName
    } catch {}
    if (!prov) {
      return NextResponse.json({ error: 'Invalid provider reference.' }, { status: 400 })
    }

    // Look up provider's user account so we can email them the lead
    try {
      const providerUser = await payload.find({
        collection: 'users',
        where: { linkedProvider: { equals: providerIdNum } },
        limit: 1,
        overrideAccess: true,
      })
      if (providerUser.docs.length > 0) {
        providerUserEmail = (providerUser.docs[0] as any).email || null
      }
    } catch {}

    if (clinicId && clinicIdNum) {
      try {
        const clinic = await payload.findByID({ collection: 'clinics', id: clinicIdNum, depth: 0, overrideAccess: true })
        if (!clinic) {
          return NextResponse.json({ error: 'Invalid clinic reference.' }, { status: 400 })
        }
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

  // Send emails non-blocking (failures must not fail the booking response)
  void (async () => {
    try {
      const sFirst = sanitize(firstName)
      const sProviderFirst = sanitize(providerName.split(' ')[0] || providerName)
      const sPhone = sanitize(phone || '')
      const sTreatment = sanitize(treatmentTag || '')
      const sDate = sanitize(preferredDate || '')
      const sMsg = sanitize(message || '')

      const patientOpts = { patientFirstName: sFirst, providerName: sanitize(providerName), clinicName: sanitize(clinicName), treatmentTag: sTreatment, preferredDate: sDate, message: sMsg, bookingId }
      const adminOpts = { patientName: sanitize(patientName), patientEmail: sanitize(email), patientPhone: sPhone, providerName: sanitize(providerName), clinicName: sanitize(clinicName), treatmentTag: sTreatment, preferredDate: sDate, message: sMsg, bookingId }

      const sends: Promise<void>[] = [
        sendTransactional({ to: email, subject: `Consultation request for ${sanitize(providerName)} — injector.world`, ...bookingPatientEmail(patientOpts), tag: 'booking-patient' }),
        sendTransactional({ to: adminRecipients(), subject: `New booking: ${sanitize(patientName)} for ${sanitize(providerName)}`, ...bookingAdminEmail(adminOpts), tag: 'booking-admin' }),
      ]

      if (providerUserEmail) {
        const provOpts = { providerFirstName: sProviderFirst, patientName: sanitize(patientName), patientEmail: sanitize(email), patientPhone: sPhone, treatmentTag: sTreatment, preferredDate: sDate, message: sMsg, bookingId }
        sends.push(sendTransactional({ to: providerUserEmail, subject: `New consultation request — injector.world`, ...bookingProviderEmail(provOpts), tag: 'booking-provider' }))
      }

      await Promise.allSettled(sends)
    } catch (emailErr) {
      console.error('[bookings] email send failed:', emailErr)
    }
  })()

  return NextResponse.json({ success: true, bookingId: String(bookingId) })
}
