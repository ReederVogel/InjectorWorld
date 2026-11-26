/** A clinic owner's view of their bookings (collections/Bookings.ts). Client-safe: no server imports. */

/** Same values and order as the Bookings status field. */
export const LEAD_STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No-show' },
] as const

export type LeadStatus = (typeof LEAD_STATUSES)[number]['value']
export const isLeadStatus = (v: unknown): v is LeadStatus => LEAD_STATUSES.some((s) => s.value === v)

export type OwnerLead = {
  id: number
  name: string
  email: string
  phone?: string
  treatment?: string
  preferred?: string
  message?: string
  status: LeadStatus
  /** Formatted on the server (UTC) so the client renders the same text. */
  received: string
}

const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

export function toOwnerLead(b: any): OwnerLead {
  return {
    id: Number(b.id),
    name: b.patientName || 'No name given',
    email: b.patientEmail || '',
    phone: b.patientPhone || undefined,
    treatment: b.serviceTag || undefined,
    preferred: [b.preferredDate ? day(b.preferredDate) : '', b.preferredTime || ''].filter(Boolean).join(', ') || undefined,
    message: b.message || undefined,
    status: isLeadStatus(b.status) ? b.status : 'new',
    received: b.createdAt ? day(b.createdAt) : '',
  }
}
