import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { RateLimiter, checkOrigin, getIp } from '@/lib/rate-limit'
import { verifyTurnstile } from '@/lib/captcha'
import { LISTING_REPORT_REASONS } from '@/lib/listing-report-reasons'

// Not /api/listing-reports: a route there shadows Payload's REST path for the
// collection, which breaks admin bulk edit/delete and list fetches.
// 5 reports per IP per hour.
const limiter = new RateLimiter(5, 60 * 60 * 1000)

const REASON_VALUES = LISTING_REPORT_REASONS.map((r) => r.value) as [string, ...string[]]

const optionalString = (max: number) => z.string().max(max).optional().default('')

const ReportSchema = z
  .object({
    clinicId: z.preprocess((v) => Number(v), z.number().int().positive()),
    reason: z.enum(REASON_VALUES, { message: 'Pick what is wrong' }),
    details: optionalString(2000),
    reporterName: optionalString(160),
    reporterEmail: z.union([z.literal(''), z.string().email('Enter a valid email address').max(254)]).optional().default(''),
    pageUrl: optionalString(500),
    turnstileToken: optionalString(2000),
    _hp: optionalString(200),
  })
  .refine((d) => d.reason !== 'other' || d.details.trim().length > 0, {
    path: ['details'],
    message: 'Tell us what is wrong',
  })

const sanitize = (s: string) => (s ?? '').replace(/[\r\t]/g, ' ').trim()

function fieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !fields[key]) fields[key] = issue.message
  }
  return fields
}

export async function POST(req: NextRequest) {
  try {
    let raw: any
    try {
      raw = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    if (sanitize(String(raw?._hp || ''))) {
      return NextResponse.json({ success: true })
    }

    if (!checkOrigin(req)) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    const ip = getIp(req)
    if (!(await limiter.check(`listing-reports:${ip}`))) {
      return NextResponse.json(
        { error: 'Too many reports. Please wait before sending another.' },
        { status: 429 },
      )
    }

    const parsed = ReportSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed.', fieldErrors: fieldErrors(parsed.error) },
        { status: 400 },
      )
    }

    const captchaOk = !parsed.data.turnstileToken && process.env.NODE_ENV !== 'production'
      ? true
      : await verifyTurnstile(parsed.data.turnstileToken, ip)
    if (!captchaOk) {
      return NextResponse.json({ error: 'CAPTCHA verification failed. Please try again.' }, { status: 403 })
    }

    const payload = await getPayload({ config })
    let clinic: any = null
    try {
      clinic = await payload.findByID({ collection: 'clinics', id: parsed.data.clinicId, depth: 0, overrideAccess: true })
    } catch {
      clinic = null
    }
    if (!clinic) {
      return NextResponse.json({ error: 'Invalid clinic reference.' }, { status: 400 })
    }

    // Only keep a same-site clinic path; anything else is noise in the admin.
    const pageUrl = sanitize(parsed.data.pageUrl)

    await payload.create({
      collection: 'listing-reports',
      overrideAccess: true,
      data: {
        clinic: clinic.id,
        clinicName: sanitize(clinic.clinicName || '') || `Clinic ${clinic.id}`,
        pageUrl: pageUrl.startsWith('/clinics/') ? pageUrl : undefined,
        reason: parsed.data.reason as any,
        details: sanitize(parsed.data.details) || undefined,
        reporterName: sanitize(parsed.data.reporterName) || undefined,
        reporterEmail: sanitize(parsed.data.reporterEmail) || undefined,
        status: 'new',
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[listing-reports] unexpected error:', err)
    return NextResponse.json(
      { error: 'Could not send your report. Please try again later.' },
      { status: 500 },
    )
  }
}
