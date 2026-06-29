import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { RateLimiter, checkOrigin, getIp } from '@/lib/rate-limit'
import { verifyTurnstile } from '@/lib/captcha'
import { emailShell } from '@/lib/email'
import { sendTransactional } from '@/lib/email-templates'

// 3 booking submissions per IP per hour.
const limiter = new RateLimiter(3, 60 * 60 * 1000)

const DATE_RANGE_LABELS = {
  'next-7-days': 'Next 7 days',
  'next-2-weeks': 'Next 2 weeks',
  'next-month': 'Next month',
  flexible: 'Flexible',
} as const

const optionalString = (max: number) => z.string().max(max).optional().default('')
const optionalPositiveInt = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === '') return undefined
    const num = Number(value)
    return Number.isFinite(num) ? num : value
  },
  z.number().int().positive().optional(),
)
const positiveInt = z.preprocess(
  (value) => {
    const num = Number(value)
    return Number.isFinite(num) ? num : value
  },
  z.number().int().positive(),
)

const BookingSchema = z.object({
  kind: z.enum(['provider', 'clinic']),
  targetId: positiveInt,
  targetName: optionalString(200),
  patientName: z.string().min(1, 'Name is required').max(160, 'Name is too long'),
  patientEmail: z.string().email('Enter a valid email address').max(254),
  patientPhone: optionalString(40),
  treatmentId: optionalPositiveInt,
  treatmentName: optionalString(120),
  preferredDateRange: z.enum(['next-7-days', 'next-2-weeks', 'next-month', 'flexible']),
  message: optionalString(2000),
  turnstileToken: optionalString(2000),
  _hp: optionalString(200),
})

type BookingInput = z.infer<typeof BookingSchema>
type PayloadClient = Awaited<ReturnType<typeof getPayload>>

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'
const FALLBACK_ADMIN_EMAIL = 'admin@injector.world'

const sanitize = (s: string) => (s ?? '').replace(/[\r\n\t]/g, ' ').trim()

function fieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !fields[key]) fields[key] = issue.message
  }
  return fields
}

function getAdminEmail(): string {
  const adminEmail = sanitize(process.env.ADMIN_EMAIL || '')
  if (adminEmail) return adminEmail
  console.error('[BOOKING] ADMIN_EMAIL not set; using admin@injector.world')
  return FALLBACK_ADMIN_EMAIL
}

function relationId(value: unknown): number | undefined {
  if (!value) return undefined
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  if (typeof value === 'object' && 'id' in value) {
    return relationId((value as { id?: unknown }).id)
  }
  return undefined
}

async function findByID(payload: PayloadClient, collection: string, id: number, depth = 0): Promise<any | null> {
  try {
    return await (payload as any).findByID({ collection, id, depth, overrideAccess: true })
  } catch {
    return null
  }
}

async function resolveTreatment(payload: PayloadClient, input: BookingInput): Promise<{ id?: number; name: string } | null> {
  if (!input.treatmentId) {
    return { name: sanitize(input.treatmentName || '') }
  }
  const treatment = await findByID(payload, 'services', input.treatmentId, 0)
  if (!treatment) return null
  return { id: input.treatmentId, name: sanitize(treatment.name || input.treatmentName || '') }
}

async function clinicSummary(payload: PayloadClient, clinicLike: unknown): Promise<{ id?: number; name: string; email: string }> {
  const id = relationId(clinicLike)
  if (typeof clinicLike === 'object' && clinicLike && 'id' in clinicLike) {
    const clinic = clinicLike as any
    return {
      id,
      name: sanitize(clinic.clinicName || ''),
      email: sanitize(clinic.email || ''),
    }
  }
  if (!id) return { name: '', email: '' }
  const clinic = await findByID(payload, 'clinics', id, 0)
  return {
    id,
    name: sanitize(clinic?.clinicName || ''),
    email: sanitize(clinic?.email || ''),
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function emailRow(label: string, value: string): string {
  if (!value) return ''
  return `<tr><td style="padding:3px 12px 3px 0;font-size:14px;color:#94A3B8;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:3px 0;font-size:14px;color:#0B1B34;">${escapeHtml(value)}</td></tr>`
}

function detailsTable(rows: string[]): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0 20px;border-collapse:collapse;">${rows.join('')}</table>`
}

function p(text: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#475569;">${escapeHtml(text)}</p>`
}

function plainDetails(lines: [string, string][]): string {
  return lines.filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`).join('\n')
}

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
  try {
    let raw: any
    try {
      raw = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    if (sanitize(String(raw?._hp || raw?.website || ''))) {
      console.log('[bookings] honeypot submission ignored')
      return NextResponse.json({ success: true })
    }

    if (!checkOrigin(req)) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    const ip = getIp(req)
    if (!limiter.check(`bookings:${ip}`)) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before submitting again.' },
        { status: 429 },
      )
    }

    const parsed = BookingSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed.', fieldErrors: fieldErrors(parsed.error) },
        { status: 400 },
      )
    }

    const captchaOk = !parsed.data.turnstileToken && process.env.NODE_ENV !== 'production'
      ? (console.warn('[bookings] Turnstile token missing in development; skipping verification.'), true)
      : await verifyTurnstile(parsed.data.turnstileToken, ip)
    if (!captchaOk) {
      return NextResponse.json({ error: 'CAPTCHA verification failed. Please try again.' }, { status: 403 })
    }

    const payload = await getPayload({ config })
    const adminEmail = getAdminEmail()
    const patientName = sanitize(parsed.data.patientName)
    const patientEmail = sanitize(parsed.data.patientEmail)
    const patientPhone = sanitize(parsed.data.patientPhone)
    const message = sanitize(parsed.data.message)
    const preferredDateRange = sanitize(DATE_RANGE_LABELS[parsed.data.preferredDateRange])
    const requestedTargetName = sanitize(parsed.data.targetName)
    const treatment = await resolveTreatment(payload, parsed.data)

    if (!treatment) {
      return NextResponse.json({ error: 'Invalid treatment reference.' }, { status: 400 })
    }

    let targetName = requestedTargetName
    let targetEmail = ''
    let providerId: number | undefined
    let clinicId: number | undefined
    let clinicName = ''

    if (parsed.data.kind === 'provider') {
      providerId = parsed.data.targetId
      const provider = await findByID(payload, 'providers', providerId, 1)
      if (!provider) {
        return NextResponse.json({ error: 'Invalid provider reference.' }, { status: 400 })
      }

      targetName = sanitize(provider.fullName || targetName || 'the provider')
      targetEmail = sanitize(provider.contactEmail || provider.email || '')

      const clinic = await clinicSummary(payload, provider.clinic)
      clinicId = clinic.id
      clinicName = clinic.name
      if (!targetEmail) targetEmail = clinic.email
    } else {
      clinicId = parsed.data.targetId
      const clinic = await findByID(payload, 'clinics', clinicId, 0)
      if (!clinic) {
        return NextResponse.json({ error: 'Invalid clinic reference.' }, { status: 400 })
      }

      targetName = sanitize(clinic.clinicName || targetName || 'the clinic')
      clinicName = targetName
      targetEmail = sanitize(clinic.email || '')
    }

    if (!targetEmail) targetEmail = adminEmail

    const booking = await payload.create({
      collection: 'bookings',
      overrideAccess: true,
      data: {
        patientName,
        patientEmail,
        patientPhone: patientPhone || undefined,
        provider: providerId as any,
        clinic: clinicId as any,
        treatment: treatment.id as any,
        treatmentTag: treatment.name || undefined,
        preferredTime: preferredDateRange,
        message: message || undefined,
        consentToContact: true,
        status: 'new',
        source: 'website',
      } as any,
    })

    const bookingId = booking.id
    const adminLink = `${SITE_URL}/admin/collections/bookings/${bookingId}`
    const detailLines: [string, string][] = [
      ['From', patientName],
      ['Email', patientEmail],
      ['Phone', patientPhone],
      ['Treatment', treatment.name || 'Not sure yet'],
      ['Preferred date range', preferredDateRange],
      ['Message', message],
      ['Booking ID', String(bookingId)],
    ]

    const targetHtml = emailShell({
      siteUrl: SITE_URL,
      heading: `New consultation request for ${escapeHtml(targetName)}`,
      bodyHtml: [
        p('You have a new consultation request through injector.world.'),
        detailsTable(detailLines.map(([label, value]) => emailRow(label, value))),
        p('Reply directly to this email to reach the patient.'),
      ].join(''),
    })
    const targetText = [
      `New consultation request for ${targetName}`,
      '',
      plainDetails(detailLines),
      '',
      'Reply directly to this email to reach the patient.',
    ].join('\n')

    const adminLines: [string, string][] = [
      ['Patient', patientName],
      ['Patient email', patientEmail],
      ['Patient phone', patientPhone],
      ['Target kind', parsed.data.kind],
      ['Target', targetName],
      ['Target email', targetEmail],
      ['Clinic', clinicName],
      ['Treatment', treatment.name || 'Not sure yet'],
      ['Preferred date range', preferredDateRange],
      ['Message', message],
      ['Booking ID', String(bookingId)],
      ['Admin link', adminLink],
    ]
    const adminHtml = emailShell({
      siteUrl: SITE_URL,
      heading: `Booking from ${escapeHtml(patientName)} for ${escapeHtml(targetName)}`,
      bodyHtml: [
        p('A booking request was saved in Payload.'),
        detailsTable(adminLines.map(([label, value]) => emailRow(label, value))),
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.7;"><a href="${escapeHtml(adminLink)}" style="color:#3FA68A;text-decoration:none;">View booking in admin</a></p>`,
      ].join(''),
    })
    const adminText = [
      `Booking from ${patientName} for ${targetName}`,
      '',
      plainDetails(adminLines),
    ].join('\n')

    try {
      await Promise.allSettled([
        sendTransactional({
          to: targetEmail,
          replyTo: patientEmail,
          subject: `New consultation request - ${targetName}`,
          html: targetHtml,
          text: targetText,
          tag: 'booking-target',
        }),
        sendTransactional({
          to: adminEmail,
          subject: `[ADMIN COPY] Booking from ${patientName} for ${targetName}`,
          html: adminHtml,
          text: adminText,
          tag: 'booking-admin',
        }),
      ])
    } catch (emailErr) {
      console.error('[bookings] email send failed:', emailErr)
    }

    return NextResponse.json({ success: true, bookingId })
  } catch (err) {
    console.error('[bookings] unexpected error:', err)
    return NextResponse.json(
      { error: 'Could not save your request. Please email us directly.' },
      { status: 500 },
    )
  }
}
