'use client'

import Link from 'next/link'
import { useSession } from '@/components/account/SessionContext'

/**
 * Owner-only "your profile is live, is it complete?" nudge on the PUBLIC
 * clinic page. This page is ISR-cached (revalidate = 300s) for ~13k clinics,
 * so we deliberately do NOT check auth server-side here — that would force
 * the whole page dynamic and kill caching for every visitor, not just the
 * rare owner. Instead this checks the session client-side, after hydration,
 * exactly like the header's logged-in state does. Regular patients (not
 * logged in, or logged in as someone else) see nothing — this returns null.
 */
export function OwnerCompletionBanner({
  clinicId,
  missingLabels,
}: {
  clinicId: number | string
  missingLabels: string[]
}) {
  const { user, loading } = useSession()

  if (loading || !user) return null
  if (user.linkedClinic !== String(clinicId)) return null
  if (missingLabels.length === 0) return null

  return (
    // Left-aligned mint card as of 2026-08-06: this sits inside the profile's
    // left column now, next to the claim card, not in a full-width band.
    <section>
      <div className="rounded-2xl bg-brand-accent-soft p-7 md:p-9">
        <h2 className="font-serif text-h3 text-ink-primary">Your profile is live. Is it complete?</h2>
        <p className="mt-2 max-w-[60ch] text-body-sm text-ink-secondary">
          {missingLabels.join(', ')}. Patients choose complete profiles over blank ones.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <Link
            href="/dashboard/clinic"
            className="inline-flex min-h-11 items-center justify-center rounded-control bg-brand-primary px-6 py-3 text-body-sm font-semibold text-surface-canvas transition hover:opacity-90"
          >
            Complete my profile
          </Link>
          <span className="text-body-sm text-ink-secondary">Free · Takes about a minute</span>
        </div>
      </div>
    </section>
  )
}
