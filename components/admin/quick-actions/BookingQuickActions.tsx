'use client'

import type { MouseEvent } from 'react'
import { useQuickAction } from './useQuickAction'
import { approveStyle, rejectStyle, errorStyle } from './ClaimQuickActions'

type Props = {
  id: number | string
  status: string
  onDone: (newStatus: string) => void
}

/** Inline Confirm/Cancel buttons for a `new` lead. Completed/no-show stay in the full form. */
export function BookingQuickActions({ id, status, onDone }: Props) {
  const { busy, error, run } = useQuickAction()

  if (status !== 'new') return null

  async function act(e: MouseEvent, action: 'confirm' | 'cancel') {
    e.preventDefault()
    e.stopPropagation()
    const ok = await run(() =>
      fetch('/api/admin/bookings/quick-action', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, action }),
      }),
    )
    if (ok) onDone(action === 'confirm' ? 'confirmed' : 'cancelled')
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
      <button type="button" disabled={busy} onClick={(e) => act(e, 'confirm')} style={approveStyle}>
        Confirm
      </button>
      <button type="button" disabled={busy} onClick={(e) => act(e, 'cancel')} style={rejectStyle}>
        Cancel
      </button>
      {error && <span style={errorStyle}>{error}</span>}
    </span>
  )
}
