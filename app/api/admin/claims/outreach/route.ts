import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdminOrEditor } from '@/lib/auth-guards'
import { checkOrigin } from '@/lib/rate-limit'
import { sendTransactional, claimInviteEmail, SITE_URL } from '@/lib/email-templates'
import { outreachUnsubscribeUrl, outreachInviteToken } from '@/lib/outreach'

export const dynamic = 'force-dynamic'

/**
 * Claims Control Center — outreach API.
 *
 * GET  ?state=&city=&zip=&q=&claimed=&invited=&sort=&page=&limit=
 *   Lists published clinics that have an email address, with claim/invite
 *   status per row, for the outreach table on the admin Claims page.
 *
 * POST { clinicIds: number[] }  (max 50 per call — deliberate throttle)
 *   Sends a claim-invite email per clinic. Skips: no email, already claimed,
 *   unsubscribed address. Upserts a ClaimInvite record per clinic+email.
 */

const MAX_BATCH = 50

function relId(rel: unknown): number | null {
  if (rel == null) return null
  if (typeof rel === 'object') return Number((rel as { id?: number | string }).id)
  return Number(rel)
}

export async function GET(req: NextRequest) {
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdminOrEditor(user)
  if (guard) return guard

  const url = new URL(req.url)
  const state = (url.searchParams.get('state') || '').trim().toUpperCase()
  const city = (url.searchParams.get('city') || '').trim()
  const zip = (url.searchParams.get('zip') || '').trim()
  const q = (url.searchParams.get('q') || '').trim()
  const claimedFilter = url.searchParams.get('claimed') || ''
  const invitedFilter = url.searchParams.get('invited') || ''
  const sort = url.searchParams.get('sort') || 'clinicName'
  const page = Math.max(parseInt(url.searchParams.get('page') || '1', 10), 1)
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '25', 10), 1), 100)

  const and: any[] = [
    { status: { equals: 'published' } },
    { email: { exists: true } },
    { email: { not_equals: '' } },
  ]
  if (state) and.push({ state: { equals: state } })
  if (city) and.push({ city: { like: city } })
  if (zip) and.push({ zip: { equals: zip } })
  if (q) and.push({ clinicName: { like: q } })
  if (claimedFilter === 'yes') and.push({ claimed: { equals: true } })
  if (claimedFilter === 'no') and.push({ claimed: { not_equals: true } })

  // Invited filter: resolve invited clinic IDs first (claim-invites is small
  // relative to clinics; grows with outreach but stays queryable).
  if (invitedFilter === 'yes' || invitedFilter === 'no') {
    const invites = await payload.find({
      collection: 'claim-invites',
      limit: 10000,
      depth: 0,
      overrideAccess: true,
    })
    const invitedIds = [...new Set(
      invites.docs.map((d: any) => relId(d.targetClinic)).filter((n): n is number => !!n),
    )]
    if (invitedFilter === 'yes') {
      if (invitedIds.length === 0) {
        return NextResponse.json({ docs: [], totalDocs: 0, page: 1, totalPages: 1 })
      }
      and.push({ id: { in: invitedIds } })
    } else if (invitedIds.length > 0) {
      and.push({ id: { not_in: invitedIds } })
    }
  }

  const allowedSorts = new Set(['clinicName', '-clinicName', '-createdAt', 'city', 'state'])
  const safeSort = allowedSorts.has(sort) ? sort : 'clinicName'

  const result = await payload.find({
    collection: 'clinics',
    where: { and },
    limit,
    page,
    sort: safeSort,
    depth: 0,
    overrideAccess: true,
  })

  // Invite status for just this page of clinics
  const pageIds = result.docs.map((d: any) => d.id)
  const inviteByClinic: Record<number, { status: string; sendCount: number; lastSentAt: string | null }> = {}
  if (pageIds.length > 0) {
    const invites = await payload.find({
      collection: 'claim-invites',
      where: { targetClinic: { in: pageIds } },
      limit: pageIds.length * 2,
      depth: 0,
      overrideAccess: true,
    })
    for (const inv of invites.docs as any[]) {
      const cid = relId(inv.targetClinic)
      if (cid) inviteByClinic[cid] = { status: inv.status, sendCount: inv.sendCount ?? 1, lastSentAt: inv.lastSentAt ?? null }
    }
  }

  return NextResponse.json({
    docs: (result.docs as any[]).map((c) => ({
      id: c.id,
      clinicName: c.clinicName,
      city: c.city,
      state: c.state,
      zip: c.zip ?? '',
      email: c.email,
      slug: c.slug,
      claimed: Boolean(c.claimed),
      invite: inviteByClinic[c.id] ?? null,
    })),
    totalDocs: result.totalDocs,
    page: result.page,
    totalPages: result.totalPages,
  })
}

const SendSchema = z.object({
  clinicIds: z.array(z.number().int().positive()).min(1).max(MAX_BATCH),
})

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

  const parsed = SendSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: `Send between 1 and ${MAX_BATCH} clinics per batch.` },
      { status: 422 },
    )
  }

  let sent = 0
  const skipped: { id: number; reason: string }[] = []

  for (const clinicId of parsed.data.clinicIds) {
    let clinic: any
    try {
      clinic = await payload.findByID({ collection: 'clinics', id: clinicId, depth: 0, overrideAccess: true })
    } catch {
      skipped.push({ id: clinicId, reason: 'not found' })
      continue
    }

    const email = String(clinic.email || '').trim().toLowerCase()
    if (!email) {
      skipped.push({ id: clinicId, reason: 'no email' })
      continue
    }
    if (clinic.claimed) {
      skipped.push({ id: clinicId, reason: 'already claimed' })
      continue
    }
    if (clinic.status !== 'published') {
      skipped.push({ id: clinicId, reason: 'not published' })
      continue
    }

    // Suppression: never email an address that unsubscribed, on any clinic
    const suppressed = await payload.find({
      collection: 'claim-invites',
      where: { and: [{ email: { equals: email } }, { status: { equals: 'unsubscribed' } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (suppressed.docs.length > 0) {
      skipped.push({ id: clinicId, reason: 'unsubscribed' })
      continue
    }

    // Upsert the tracking record first — the invite id goes into the claim
    // link as a signed token so the claim form can prefill the email.
    let inviteId: number | string | null = null
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
          data: { sendCount: (doc.sendCount ?? 1) + 1, lastSentAt: now, sentBy: user!.id, status: doc.status === 'claimed' ? 'claimed' : 'sent' },
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
      payload.logger.error(`[claims/outreach] invite record upsert failed for clinic ${clinicId}: ${err}`)
    }

    const inv = inviteId != null ? `&inv=${outreachInviteToken(inviteId)}` : ''
    const claimUrl = `${SITE_URL}/claim/clinic/${clinic.slug}?src=invite${inv}`
    const unsubscribeUrl = outreachUnsubscribeUrl(SITE_URL, email)

    // Sequential await = natural throttle within the 50-cap batch
    await sendTransactional({
      to: email,
      subject: `Claim ${clinic.clinicName} on injector.world`,
      ...claimInviteEmail({
        clinicName: clinic.clinicName,
        city: clinic.city || '',
        state: clinic.state || '',
        claimUrl,
        unsubscribeUrl,
      }),
      tag: 'claim-invite',
    })

    sent++
  }

  return NextResponse.json({ sent, skipped })
}
