'use client'

import { useEffect } from 'react'
import { track } from '@/lib/analytics/client'
import { ConsultationForm, type BookingKind, type TreatmentOption } from './ConsultationForm'

/**
 * Dialog chrome around the consultation form.
 *
 * The form itself moved to ConsultationForm on 2026-08-06 so the clinic profile
 * sidebar can render it inline. Everything here is modal-specific: escape to
 * close, the booking_open event, and the auto-close a few seconds after a
 * successful send.
 */

type BookingModalProps = {
  kind: BookingKind
  targetId: number
  targetName: string
  servicesOffered?: TreatmentOption[]
  open: boolean
  onClose: () => void
}

export function BookingModal({
  kind,
  targetId,
  targetName,
  servicesOffered = [],
  open,
  onClose,
}: BookingModalProps) {
  useEffect(() => {
    if (!open) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, open])

  useEffect(() => {
    if (open) track('booking_open', { entityType: kind, entityId: targetId })
  }, [open, kind, targetId])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-modal-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="max-h-[calc(100vh-3rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface-canvas shadow-hover">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 id="booking-modal-title" className="font-serif text-h3 text-ink-primary">
              Request a consultation at {targetName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-ink-secondary transition hover:bg-surface hover:text-ink-primary"
            aria-label="Close booking form"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <ConsultationForm
          kind={kind}
          targetId={targetId}
          targetName={targetName}
          servicesOffered={servicesOffered}
          active={open}
          className="space-y-4 px-5 py-5"
          onSuccess={() => {
            window.setTimeout(onClose, 5000)
          }}
        />
      </div>
    </div>
  )
}
