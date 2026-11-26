'use client'

import { useState } from 'react'
import { SignedOutNotice } from './SignedOutNotice'
import { LEAD_STATUSES, type LeadStatus, type OwnerLead } from '@/lib/owner-leads'

const STATUS_CLASS: Record<LeadStatus, string> = {
  new: 'bg-[#FEF3C7] text-[#92400E]',
  confirmed: 'bg-brand-accent-soft text-brand-accent',
  completed: 'bg-[#F0FDF4] text-[#166534]',
  cancelled: 'bg-[#FEE2E2] text-[#991B1B]',
  no_show: 'bg-surface-warm text-ink-secondary',
}
const label = (s: LeadStatus) => LEAD_STATUSES.find((x) => x.value === s)?.label ?? s

/**
 * The owner's latest consultation requests. Pro and Elite (`tools`) can move a
 * lead's status and download every lead as CSV; everyone sees the list.
 */
export function LeadsList({
  clinicId,
  initial,
  total,
  tools,
  contactEmail,
}: {
  clinicId: number
  initial: OwnerLead[]
  total: number
  tools: boolean
  /** Where /api/bookings sends each request; with none set, only our team gets them. */
  contactEmail?: string
}) {
  const [leads, setLeads] = useState(initial)
  const [saving, setSaving] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [signedOut, setSignedOut] = useState(false)

  async function setStatus(lead: OwnerLead, status: LeadStatus) {
    const before = lead.status
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status } : l)))
    setSaving(lead.id)
    setError('')
    const res = await fetch(`/api/dashboard/leads?clinic=${clinicId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: lead.id, status }),
      credentials: 'include',
    }).catch(() => null)
    setSaving(null)
    if (res?.ok) return
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status: before } : l)))
    if (res?.status === 401) setSignedOut(true)
    else setError('Could not save the status. Please retry.')
  }

  if (leads.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center">
        <p className="text-body text-ink-secondary">No leads yet. Your clinic page is live and accepting consultation requests.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-body-sm text-ink-secondary">
          {total > leads.length ? `Your latest ${leads.length} of ${total.toLocaleString('en-US')} requests.` : `${total} request${total === 1 ? '' : 's'}.`}{' '}
          {contactEmail ? `New ones also go to ${contactEmail}.` : 'Add a contact email above to get new ones by email.'}
        </p>
        {tools ? (
          <a
            href={`/api/dashboard/leads?clinic=${clinicId}&format=csv`}
            className="rounded-control border border-border px-3 py-1.5 text-body-sm font-medium text-ink-primary transition hover:border-ink-secondary"
          >
            Download all (CSV)
          </a>
        ) : (
          <a href="/pricing" className="text-body-sm text-brand-accent hover:underline">
            Track and export leads on Pro
          </a>
        )}
      </div>

      <div className="space-y-3">
        {leads.map((l) => (
          <div key={l.id} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-body-sm font-medium text-ink-primary">{l.name}</p>
                <p className="break-words text-caption text-ink-tertiary">
                  {[l.email, l.phone, `Received ${l.received}`].filter(Boolean).join(' · ')}
                </p>
              </div>
              {tools ? (
                <select
                  value={l.status}
                  onChange={(e) => setStatus(l, e.target.value as LeadStatus)}
                  disabled={saving === l.id}
                  aria-label={`Status for ${l.name}`}
                  className={`rounded-control border-0 px-2.5 py-1 text-[12px] font-semibold disabled:opacity-60 ${STATUS_CLASS[l.status]}`}
                >
                  {LEAD_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              ) : (
                <span className={`rounded-control px-3 py-1 text-[11px] font-semibold ${STATUS_CLASS[l.status]}`}>{label(l.status)}</span>
              )}
            </div>
            {(l.treatment || l.preferred) && (
              <p className="mt-2 text-caption text-ink-secondary">
                {[l.treatment, l.preferred && `Prefers ${l.preferred}`].filter(Boolean).join(' · ')}
              </p>
            )}
            {l.message && <p className="mt-1 line-clamp-3 text-body-sm text-ink-secondary">{l.message}</p>}
          </div>
        ))}
      </div>
      {error && <p className="mt-2 text-caption text-[#B91C1C]">{error}</p>}
      {signedOut && <div className="mt-3"><SignedOutNotice /></div>}
    </div>
  )
}
