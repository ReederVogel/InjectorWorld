'use client'

import { useSaved } from '@/components/account/SavedItemsProvider'

export function ClinicSaveButton({ clinicId }: { clinicId: string }) {
  const { isSaved, toggle } = useSaved()
  const saved = isSaved('clinic', clinicId)

  return (
    <button
      type="button"
      onClick={() => toggle('clinic', clinicId)}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-pill border px-5 py-2.5 text-body-sm font-semibold transition ${
        saved
          ? 'border-brand-accent bg-brand-accent-soft text-brand-accent'
          : 'border-border bg-surface-canvas text-ink-primary hover:border-brand-accent'
      }`}
      aria-pressed={saved}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
        <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
      </svg>
      {saved ? 'Saved' : 'Save'}
    </button>
  )
}
