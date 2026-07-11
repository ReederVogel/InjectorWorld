'use client'

import type { MouseEvent } from 'react'
import { useQuickAction } from './useQuickAction'

type Props = {
  id: number | string
  status: string
  onDone: (newStatus: string) => void
}

/** Inline Approve/Reject buttons for a `new` claim. Renders nothing once the claim is decided. */
export function ClaimQuickActions({ id, status, onDone }: Props) {
  const { busy, error, run } = useQuickAction()

  if (status !== 'new') return null

  async function act(e: MouseEvent, action: 'approve' | 'reject') {
    e.preventDefault()
    e.stopPropagation()
    const ok = await run(() =>
      fetch('/api/admin/claims/quick-action', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, action }),
      }),
    )
    if (ok) onDone(action === 'approve' ? 'approved' : 'rejected')
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
      <button type="button" disabled={busy} onClick={(e) => act(e, 'approve')} style={approveStyle}>
        Approve
      </button>
      <button type="button" disabled={busy} onClick={(e) => act(e, 'reject')} style={rejectStyle}>
        Reject
      </button>
      {error && <span style={errorStyle}>{error}</span>}
    </span>
  )
}

const baseBtn = {
  fontSize: 11,
  fontWeight: 600,
  padding: '2px 8px',
  borderRadius: 999,
  background: 'transparent',
  cursor: 'pointer',
  lineHeight: '16px',
} as const

export const approveStyle = { ...baseBtn, border: '1px solid #2f8d73', color: '#2f8d73' }
export const rejectStyle = { ...baseBtn, border: '1px solid #c0392b', color: '#c0392b' }
export const errorStyle = { fontSize: 11, color: '#c0392b' }
