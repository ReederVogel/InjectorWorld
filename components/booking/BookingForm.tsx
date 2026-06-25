'use client'

import { useEffect, useMemo, useState } from 'react'
import { BookingModal } from './BookingModal'

type BookingFormProps = {
  providerId: string
  providerName: string
  providerFirstName: string
  clinicId?: string
  treatmentOptions: string[]
}

export function BookingForm({
  providerId,
  providerName,
  providerFirstName,
  treatmentOptions,
}: BookingFormProps) {
  const [open, setOpen] = useState(false)
  const numericProviderId = Number(providerId)
  const treatmentChoices = useMemo(
    () => treatmentOptions.map((name, index) => ({ id: -(index + 1), name })),
    [treatmentOptions],
  )

  useEffect(() => {
    const openFromHash = () => {
      if (window.location.hash === '#book') setOpen(true)
    }
    openFromHash()
    window.addEventListener('hashchange', openFromHash)
    return () => window.removeEventListener('hashchange', openFromHash)
  }, [])

  function closeModal() {
    setOpen(false)
    if (window.location.hash === '#book') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 w-full items-center justify-center rounded-pill bg-brand-primary px-5 py-3 text-body-sm font-semibold text-surface-canvas transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2"
      >
        Send consultation request
      </button>
      <p className="mt-3 text-center text-caption text-ink-tertiary">
        Your request goes to {providerFirstName}. No payment is taken.
      </p>
      <BookingModal
        kind="provider"
        targetId={numericProviderId}
        targetName={providerName}
        treatmentsOffered={treatmentChoices}
        open={open}
        onClose={closeModal}
      />
    </>
  )
}
