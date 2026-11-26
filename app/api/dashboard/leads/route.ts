import { NextRequest, NextResponse } from 'next/server'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { resolveOwnedClinic } from '@/lib/owned-clinics'
import { effectiveTier, limits } from '@/lib/entitlements'
import { RateLimiter, checkOrigin, getIp } from '@/lib/rate-limit'
import { csvEscape } from '@/lib/outreach'
import { isLeadStatus, LEAD_STATUSES } from '@/lib/owner-leads'

/**
 * A clinic owner's lead tools (Pro and Elite, billing active).
 *
 * GET   ?clinic=<id>&format=csv  every lead of this clinic as a CSV download
 * PATCH ?clinic=<id>  json { id, status }  moves one lead along (same statuses as admin)
 *
 * Both only ever touch bookings whose clinic is the caller's own (?clinic= is
 * checked against the account, then every query is scoped to it).
 */

const statusLimiter = new RateLimiter(300, 60 * 60 * 1000)
const csvLimiter = new RateLimiter(30, 60 * 60 * 1000)
const MAX_CSV_ROWS = 5000

async function ownerWithTools(req: NextRequest, payload: Payload) {
  const user = await getAuthUser(payload)
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated.' }, { status: 401 }) }
  if ((user as any).role !== 'clinic') return { error: NextResponse.json({ error: 'Clinic-owner account required.' }, { status: 403 }) }
  const clinicId = await resolveOwnedClinic(payload, user, req.nextUrl.searchParams.get('clinic'))
  if (!clinicId) return { error: NextResponse.json({ error: 'This clinic is not on your account.' }, { status: 403 }) }
  // overrideAccess: true — caller owns this clinic; plan fields are staff-only on REST
  const clinic: any = await payload.findByID({ collection: 'clinics', id: clinicId, depth: 0, overrideAccess: true }).catch(() => null)
  if (!clinic) return { error: NextResponse.json({ error: 'Clinic not found.' }, { status: 404 }) }
  if (!limits(effectiveTier(clinic)).leadTools) {
    return { error: NextResponse.json({ error: 'Lead tools are part of the Pro and Elite plans.' }, { status: 403 }) }
  }
  return { clinicId, clinic }
}

const stamp = (iso?: string | null) => (iso ? new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '')

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('format') !== 'csv') return NextResponse.json({ error: 'Unsupported format.' }, { status: 400 })
  const payload = await getPayload({ config })
  const owner = await ownerWithTools(req, payload)
  if ('error' in owner) return owner.error
  if (!(await csvLimiter.check(`dashboard-leads-csv:${getIp(req)}`))) {
    return NextResponse.json({ error: 'Too many downloads. Try again later.' }, { status: 429 })
  }

  // overrideAccess: true — bookings are staff-only on REST; scoped to the caller's clinic
  const res = await payload.find({
    collection: 'bookings',
    where: { clinic: { equals: owner.clinicId } },
    sort: '-createdAt',
    limit: MAX_CSV_ROWS,
    depth: 0,
    overrideAccess: true,
  })
  const label = (v: string) => LEAD_STATUSES.find((s) => s.value === v)?.label ?? v
  const header = ['Received', 'Name', 'Email', 'Phone', 'Treatment', 'Preferred date', 'Preferred time', 'Message', 'Status']
  const rows = (res.docs as any[]).map((b) =>
    [stamp(b.createdAt), b.patientName, b.patientEmail, b.patientPhone, b.serviceTag, b.preferredDate ? String(b.preferredDate).slice(0, 10) : '', b.preferredTime, b.message, label(b.status)]
      .map(csvEscape)
      .join(','),
  )
  // BOM so Excel opens accented names correctly.
  const csv = '﻿' + [header.map(csvEscape).join(','), ...rows].join('\r\n') + '\r\n'
  const slug = String(owner.clinic.slug || `clinic-${owner.clinicId}`).replace(/[^a-z0-9-]/gi, '')
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="leads-${slug}-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}

export async function PATCH(req: NextRequest) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  const payload = await getPayload({ config })
  const owner = await ownerWithTools(req, payload)
  if ('error' in owner) return owner.error
  if (!(await statusLimiter.check(`dashboard-leads-status:${getIp(req)}`))) {
    return NextResponse.json({ error: 'Too many changes. Try again later.' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const id = Number(body?.id)
  if (!id || !isLeadStatus(body?.status)) return NextResponse.json({ error: 'id and a valid status are required.' }, { status: 400 })

  // overrideAccess: true — bookings update is staff-only; the where pins it to the caller's clinic
  const res = await payload.update({
    collection: 'bookings',
    where: { and: [{ id: { equals: id } }, { clinic: { equals: owner.clinicId } }] },
    data: { status: body.status },
    overrideAccess: true,
  })
  if (!res.docs?.length) return NextResponse.json({ error: 'Lead not found.' }, { status: 404 })
  return NextResponse.json({ success: true, status: body.status })
}
