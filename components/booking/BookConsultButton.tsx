'use client'

import { useState } from 'react'
import { BookingModal } from './BookingModal'

type TreatmentOption = { id: number; name: string }

type BookConsultButtonProps = {
  kind: 'provider' | 'clinic'
  targetId: number
  targetName: string
  servicesOffered?: TreatmentOption[]
  children?: string
  className?: string
}

/**
 * UNUSED as of 2026-08-06. The clinic hero dropped its "Book a consultation"
 * button once the sidebar carried the real form (desktop) and BookPill carried
 * the shortcut (mobile). Kept in case another surface wants a modal trigger.
 */
export function BookConsultButton({
  kind,
  targetId,
  targetName,
  servicesOffered = [],
  children = 'Book a consultation',
  className,
}: BookConsultButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ||
          'inline-flex min-h-11 items-center justify-center rounded-control bg-brand-primary px-6 py-3 text-body-sm font-semibold text-surface-canvas transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2'
        }
      >
        {children}
      </button>
      <BookingModal
        kind={kind}
        targetId={targetId}
        targetName={targetName}
        servicesOffered={servicesOffered}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
