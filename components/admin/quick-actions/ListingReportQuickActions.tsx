'use client'

import type { MouseEvent } from 'react'
import { useQuickAction } from './useQuickAction'
import { approveStyle, errorStyle } from './ClaimQuickActions'

type Props = {
  id: number | string
  status: string
  onDone: (newStatus: string) => void
}

const dismissStyle = { ...approveStyle, border: '1px solid #64748b', color: '#64748b' }

/** Inline Fixed/Dismiss buttons for an open listing report (new or in review). */
export function ListingReportQuickActions({ id, status, onDone }: Props) {
  const { busy, error, run } = useQuickAction()

  if (status !== 'new' && status !== 'in_review') return null

  async function act(e: MouseEvent, next: 'fixed' | 'dismissed') {
    e.preventDefault()
    e.stopPropagation()
    const ok = await run(() =>
      fetch(`/api/listing-reports/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: next }),
      }),
    )
    if (ok) onDone(next)
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
      <button type="button" disabled={busy} onClick={(e) => act(e, 'fixed')} style={approveStyle}>
        Fixed
      </button>
      <button type="button" disabled={busy} onClick={(e) => act(e, 'dismissed')} style={dismissStyle}>
        Dismiss
      </button>
      {error && <span style={errorStyle}>{error}</span>}
    </span>
  )
}
