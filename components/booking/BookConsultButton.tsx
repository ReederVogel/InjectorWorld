'use client'

import { useState } from 'react'
import { BookingModal } from './BookingModal'

type TreatmentOption = { id: number; name: string }

type BookConsultButtonProps = {
  kind: 'provider' | 'clinic'
  targetId: number
  targetName: string
  treatmentsOffered?: TreatmentOption[]
  children?: string
  className?: string
}

export function BookConsultButton({
  kind,
  targetId,
  targetName,
  treatmentsOffered = [],
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
          'inline-flex min-h-11 items-center justify-center rounded-pill bg-brand-primary px-6 py-3 text-body-sm font-semibold text-surface-canvas transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2'
        }
      >
        {children}
      </button>
      <BookingModal
        kind={kind}
        targetId={targetId}
        targetName={targetName}
        treatmentsOffered={treatmentsOffered}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
