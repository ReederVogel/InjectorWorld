'use client'

import { useSaved } from '@/components/account/SavedItemsProvider'
import { ACTION_CIRCLE, ACTION_CIRCLE_ON, ACTION_LABEL, ACTION_STACK } from './hero-actions'

/**
 * Circle + label, sitting in the clinic hero action row beside the social links
 * (client request 2026-08-10). Was a bordered pill with the label inside it.
 */
export function ClinicSaveButton({ clinicId }: { clinicId: string }) {
  const { isSaved, toggle } = useSaved()
  const saved = isSaved('clinic', clinicId)

  return (
    <button
      type="button"
      onClick={() => toggle('clinic', clinicId)}
      className={`${ACTION_STACK} group`}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from saved' : 'Save this clinic'}
    >
      <span className={saved ? ACTION_CIRCLE_ON : ACTION_CIRCLE}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
          <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
        </svg>
      </span>
      <span className={`${ACTION_LABEL} ${saved ? 'text-brand-accent' : ''}`}>
        {saved ? 'Saved' : 'Save'}
      </span>
    </button>
  )
}
