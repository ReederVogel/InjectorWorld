import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdminOrEditor } from '@/lib/auth-guards'
import { checkOrigin } from '@/lib/rate-limit'
import { SITE_URL } from '@/lib/email-templates'
import { outreachInviteToken } from '@/lib/outreach'

/**
 * Claims Control Center — one-off "copy link" for a single clinic row.
 * Same idea as the CSV export, just for one clinic at a time: records/updates
 * the ClaimInvite (so Control Center coverage stays accurate) and hands back
 * the claim URL for the admin to paste anywhere themselves (personal email,
 * WhatsApp, in person). If the clinic has no email on file there is nothing
 * to prefill or track, so it just returns the bare claim link.
 */

const BodySchema = z.object({ clinicId: z.number().int().positive() })

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
    return NextResponse.json({ error: 'clinicId is required.' }, { status: 422 })
  }

  const { clinicId } = parsed.data

  let clinic: any
  try {
    clinic = await payload.findByID({ collection: 'clinics', id: clinicId, depth: 0, overrideAccess: true })
  } catch {
    return NextResponse.json({ error: 'Clinic not found.' }, { status: 404 })
  }

  if (clinic.claimed) {
    return NextResponse.json({ error: 'This clinic is already claimed.' }, { status: 409 })
  }

  const email = String(clinic.email || '').trim().toLowerCase()
  if (!email) {
    return NextResponse.json({
      url: `${SITE_URL}/claim/clinic/${clinic.slug}?src=admin-copy`,
      tracked: false,
    })
  }

  const suppressed = await payload.find({
    collection: 'claim-invites',
    where: { and: [{ email: { equals: email } }, { status: { equals: 'unsubscribed' } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (suppressed.docs.length > 0) {
    return NextResponse.json({ error: 'This email unsubscribed from claim invites.' }, { status: 409 })
  }

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
    payload.logger.error(`[claims/copy-link] invite record failed for clinic ${clinicId}: ${err}`)
    return NextResponse.json({ error: 'Could not record the invite.' }, { status: 500 })
  }

  return NextResponse.json({
    url: `${SITE_URL}/claim/clinic/${clinic.slug}?src=admin-copy&inv=${outreachInviteToken(inviteId)}`,
    tracked: true,
  })
}
