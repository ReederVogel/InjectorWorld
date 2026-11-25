import type { Payload } from 'payload'

export type OwnedClinic = { id: number; clinicName: string; city?: string | null; state?: string | null }

const relId = (rel: unknown): number | null =>
  rel == null ? null : Number(typeof rel === 'object' ? (rel as { id?: unknown }).id : rel) || null

/**
 * Clinics a clinic-owner account may edit: the one linked on the account first,
 * then every clinic it claimed (`clinics.claimedBy`, set on claim approval).
 * One owner can run several locations, but `Users.linkedClinic` holds one, so a
 * second approved location used to be unreachable from the dashboard (2026-11-26).
 */
export async function ownedClinics(payload: Payload, user: any): Promise<OwnedClinic[]> {
  if (!user?.id) return []
  const linked = relId(user.linkedClinic)
  const res = await payload.find({
    collection: 'clinics',
    where: linked
      ? { or: [{ claimedBy: { equals: user.id } }, { id: { equals: linked } }] }
      : { claimedBy: { equals: user.id } },
    limit: 200,
    pagination: false,
    depth: 0,
    sort: 'clinicName',
    select: { clinicName: true, city: true, state: true },
    overrideAccess: true,
  })
  const list = (res.docs as any[]).map((c) => ({ id: Number(c.id), clinicName: c.clinicName, city: c.city, state: c.state }))
  return [...list.filter((c) => c.id === linked), ...list.filter((c) => c.id !== linked)]
}

/**
 * The clinic a dashboard request edits: the requested id (`?clinic=`) when this
 * owner may edit it, their first clinic when nothing was requested, else null.
 * Each tab sends its own id, so two tabs on two clinics never write across.
 */
export async function resolveOwnedClinic(payload: Payload, user: any, requested: string | null): Promise<number | null> {
  const owned = await ownedClinics(payload, user)
  if (!requested) return owned[0]?.id ?? null
  const id = Number(requested)
  return owned.some((c) => c.id === id) ? id : null
}
