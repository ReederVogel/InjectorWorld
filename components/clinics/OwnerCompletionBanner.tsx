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
    <section className="border-y border-border bg-surface py-12">
      <div className="max-canvas text-center">
        <span className="inline-flex items-center gap-1.5 bg-brand-accent-soft text-brand-accent text-[11px] font-semibold px-3 py-1 rounded-control mb-4">
          For owners
        </span>
        <h2 className="font-serif text-h3 text-ink-primary">Your profile is live — is it complete?</h2>
        <p className="mx-auto mt-3 max-w-2xl text-body-sm text-ink-secondary">
          {missingLabels.join(', ')} — patients choose complete profiles over blank ones.
        </p>
        <Link
          href="/dashboard/clinic"
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-control bg-brand-primary px-6 py-3 text-body-sm font-semibold text-surface-canvas transition hover:opacity-90"
        >
          Complete my profile
        </Link>
      </div>
    </section>
  )
}
