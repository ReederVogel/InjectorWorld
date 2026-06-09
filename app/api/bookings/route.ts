import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@/payload.config'

// In-memory rate limit: max 5 requests per IP per hour
const rateMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 5
const WINDOW_MS = 60 * 60 * 1000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

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
})

export async function POST(req: NextRequest) {
  // Rate limit by IP
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'

  if (!checkRateLimit(ip)) {
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

  const { firstName, lastName, email, phone, treatmentTag, preferredDate, message, providerId, clinicId } =
    parsed.data

  // Relationship IDs must be raw numbers for the Postgres adapter (locked rule).
  const providerIdNum = parseInt(providerId, 10)
  if (Number.isNaN(providerIdNum)) {
    return NextResponse.json({ error: 'Invalid provider reference.' }, { status: 400 })
  }
  const clinicIdNum = clinicId ? parseInt(clinicId, 10) : undefined

  // Strip newlines to prevent email header injection
  const safeFirst = firstName.replace(/[\r\n]/g, ' ').trim()
  const safeLast = lastName.replace(/[\r\n]/g, ' ').trim()
  const patientName = `${safeFirst} ${safeLast}`.trim()

  // Save to Payload
  let bookingId: string | number
  let providerName = 'the provider'
  let clinicName = ''
  try {
    const payload = await getPayload({ config })

    // Resolve provider name for emails
    try {
      const prov = await payload.findByID({ collection: 'providers', id: providerId, depth: 1 })
      if (prov) providerName = (prov as any).fullName || providerName
    } catch {}

    if (clinicId) {
      try {
        const clinic = await payload.findByID({ collection: 'clinics', id: clinicId, depth: 0 })
        if (clinic) clinicName = (clinic as any).clinicName || ''
      } catch {}
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
    console.error('[bookings] Payload create failed:', err)
    return NextResponse.json({ error: 'Unable to save your request. Please try again.' }, { status: 500 })
  }

  // Send emails via Resend (non-blocking — don't fail the request if email fails)
  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
    try {
      const { Resend } = await import('resend')
      const resend = new Resend(resendKey)
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'

      const patientEmailBody = `
Hi ${firstName},

Your consultation request has been received.

Provider: ${providerName}
${clinicName ? `Practice: ${clinicName}` : ''}
Treatment: ${treatmentTag || 'General inquiry'}
${preferredDate ? `Preferred date: ${new Date(preferredDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}` : ''}
${message ? `\nYour message:\n${message}` : ''}

${providerName.split(' ')[0]} will be in touch within 24 hours.

This is not a confirmed appointment. Please wait for the provider to reach out to confirm.

injector.world
${siteUrl}
      `.trim()

      const adminEmailBody = `
New consultation request — Booking ID: ${bookingId}

Patient: ${patientName}
Email: ${email}
${phone ? `Phone: ${phone}` : ''}

Provider: ${providerName}
${clinicName ? `Practice: ${clinicName}` : ''}
Treatment: ${treatmentTag || 'Not specified'}
${preferredDate ? `Preferred date: ${preferredDate}` : ''}
${message ? `\nMessage:\n${message}` : ''}

View in admin: ${siteUrl}/admin/collections/bookings/${bookingId}
      `.trim()

      await Promise.allSettled([
        resend.emails.send({
          from: 'bookings@injector.world',
          to: email,
          subject: `Your consultation request for ${providerName} — injector.world`,
          text: patientEmailBody,
        }),
        resend.emails.send({
          from: 'bookings@injector.world',
          to: process.env.ADMIN_EMAIL || 'admin@injector.world',
          subject: `New booking request: ${patientName} for ${providerName}`,
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
