import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdminOrEditor } from '@/lib/auth-guards'
import { checkOrigin } from '@/lib/rate-limit'
import { SITE_URL } from '@/lib/email-templates'
import { outreachInviteToken, csvEscape } from '@/lib/outreach'

export const dynamic = 'force-dynamic'

/**
 * Claims Control Center — bulk claim-link export (CSV).
 *
 * Unlike the FAQ export (read-only GET), this is a POST behind checkOrigin:
 * exporting a clinic's claim link records/updates its ClaimInvite (same as a
 * real send) so Control Center coverage stats stay accurate even when the
 * admin sends the link manually (email, WhatsApp, in person) instead of
 * through the built-in Resend sender.
 *
 * Body:
 *   { clinicIds: number[] }                          — export exactly these
 *   { filters: {...}, limit?: number }                — export up to `limit`
 *     clinics matching the same filters as the outreach table (state/city/
 *     zip/q/claimed/invited/sort). limit defaults to 500, capped at MAX_EXPORT.
 */

const MAX_EXPORT = 1000

const FilterSchema = z.object({
  state: z.string().max(2).optional(),
  city: z.string().max(200).optional(),
  zip: z.string().max(20).optional(),
  q: z.string().max(200).optional(),
  claimed: z.enum(['yes', 'no', '']).optional(),
  invited: z.enum(['yes', 'no', '']).optional(),
  sort: z.string().max(30).optional(),
})

const BodySchema = z.object({
  clinicIds: z.array(z.number().int().positive()).max(MAX_EXPORT).optional(),
  filters: FilterSchema.optional(),
  limit: z.number().int().positive().max(MAX_EXPORT).optional(),
})

function relId(rel: unknown): number | null {
  if (rel == null) return null
  if (typeof rel === 'object') return Number((rel as { id?: number | string }).id)
  return Number(rel)
}

const CSV_HEADER = 'Clinic Name,City,State,ZIP,Phone,Email,Claim Link,Invite Status,Note'

function csvFilename(): string {
  return `claim-links-${new Date().toISOString().slice(0, 10)}.csv`
}

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdminOrEditor(user)
  if (guard) return guard

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid export request.' }, { status: 422 })
  }

  let clinicIds: number[] = []

  if (parsed.data.clinicIds && parsed.data.clinicIds.length > 0) {
    clinicIds = parsed.data.clinicIds
  } else {
    const f = parsed.data.filters || {}
    const limit = Math.min(parsed.data.limit ?? 500, MAX_EXPORT)

    const and: any[] = [
      { status: { equals: 'published' } },
      { email: { exists: true } },
      { email: { not_equals: '' } },
    ]
    if (f.state) and.push({ state: { equals: f.state.toUpperCase() } })
    if (f.city) and.push({ city: { like: f.city } })
    if (f.zip) and.push({ zip: { equals: f.zip } })
    if (f.q) and.push({ clinicName: { like: f.q } })
    if (f.claimed === 'yes') and.push({ claimed: { equals: true } })
    if (f.claimed === 'no') and.push({ claimed: { not_equals: true } })

    if (f.invited === 'yes' || f.invited === 'no') {
      const invites = await payload.find({
        collection: 'claim-invites',
        limit: 10000,
        depth: 0,
        overrideAccess: true,
      })
      const invitedIds = [...new Set(
        invites.docs.map((d: any) => relId(d.targetClinic)).filter((n): n is number => !!n),
      )]
      if (f.invited === 'yes') {
        if (invitedIds.length === 0) {
          return new NextResponse(`${CSV_HEADER}\n`, {
            headers: {
              'Content-Type': 'text/csv; charset=utf-8',
              'Content-Disposition': `attachment; filename="${csvFilename()}"`,
            },
          })
        }
        and.push({ id: { in: invitedIds } })
      } else if (invitedIds.length > 0) {
        and.push({ id: { not_in: invitedIds } })
      }
    }

    const allowedSorts = new Set(['clinicName', '-clinicName', '-createdAt', 'city', 'state'])
    const safeSort = allowedSorts.has(f.sort || '') ? (f.sort as string) : 'clinicName'

    const result = await payload.find({
      collection: 'clinics',
      where: { and },
      limit,
      sort: safeSort,
      depth: 0,
      overrideAccess: true,
    })
    clinicIds = (result.docs as any[]).map((d) => d.id)
  }

  const rows: string[] = [CSV_HEADER]

  for (const clinicId of clinicIds) {
    let clinic: any
    try {
      clinic = await payload.findByID({ collection: 'clinics', id: clinicId, depth: 0, overrideAccess: true })
    } catch {
      rows.push([csvEscape(`Clinic #${clinicId}`), '""', '""', '""', '""', '""', '""', '""', csvEscape('Clinic not found')].join(','))
      continue
    }

    const email = String(clinic.email || '').trim().toLowerCase()
    const base = [
      csvEscape(clinic.clinicName),
      csvEscape(clinic.city || ''),
      csvEscape(clinic.state || ''),
      csvEscape(clinic.zip || ''),
      csvEscape(clinic.phone || ''),
      csvEscape(email),
    ]

    if (clinic.claimed) {
      rows.push([...base, csvEscape(''), csvEscape(''), csvEscape('Already claimed')].join(','))
      continue
    }

    if (!email) {
      const url = `${SITE_URL}/claim/clinic/${clinic.slug}?src=export`
      rows.push([...base, csvEscape(url), csvEscape('Not tracked'), csvEscape('No email on file — link not tied to an invite record')].join(','))
      continue
    }

    const suppressed = await payload.find({
      collection: 'claim-invites',
      where: { and: [{ email: { equals: email } }, { status: { equals: 'unsubscribed' } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (suppressed.docs.length > 0) {
      rows.push([...base, csvEscape(''), csvEscape(''), csvEscape('Unsubscribed — link withheld')].join(','))
      continue
    }

    // Find or create the invite record — exporting a link counts as an
    // invite send, same bookkeeping as the built-in email sender, just
    // without actually emailing anyone.
    let inviteId: number | string
    try {
      const existing = await payload.find({
        collection: 'claim-invites',
        where: { and: [{ targetClinic: { equals: clinicId } }, { email: { equals: email } }] },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const now = new Date().toISOString()
      if (existing.docs.length > 0) {
        const doc = existing.docs[0] as any
        inviteId = doc.id
        await payload.update({
          collection: 'claim-invites',
          id: doc.id,
          data: {
            sendCount: (doc.sendCount ?? 0) + 1,
            lastSentAt: now,
            sentBy: user!.id,
            status: doc.status === 'claimed' ? 'claimed' : 'sent',
          },
          overrideAccess: true,
        })
      } else {
        const created = await payload.create({
          collection: 'claim-invites',
          data: { targetClinic: clinicId, email, status: 'sent', sendCount: 1, lastSentAt: now, sentBy: user!.id },
          overrideAccess: true,
        })
        inviteId = created.id
      }
    } catch (err) {
      payload.logger.error(`[claims/export] invite record failed for clinic ${clinicId}: ${err}`)
      rows.push([...base, csvEscape(''), csvEscape(''), csvEscape('Error creating invite record')].join(','))
      continue
    }

    const url = `${SITE_URL}/claim/clinic/${clinic.slug}?src=export&inv=${outreachInviteToken(inviteId)}`
    rows.push([...base, csvEscape(url), csvEscape('Invited'), csvEscape('')].join(','))
  }

  return new NextResponse(rows.join('\n') + '\n', {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${csvFilename()}"`,
    },
  })
}
