'use client'

import { useState, type MouseEvent } from 'react'
import { useQuickAction } from './useQuickAction'

type Props = {
  id: number | string
  status: string
  onDone: (newStatus: string) => void
}

/**
 * Inline Approve/Reject buttons for a `new` claim, and "Resend setup email" for
 * an approved one (lost, spammed or expired first email). Nothing for rejected.
 */
export function ClaimQuickActions({ id, status, onDone }: Props) {
  const { busy, error, run } = useQuickAction()
  const [resent, setResent] = useState(false)

  const send = (action: 'approve' | 'reject' | 'resend-setup') =>
    fetch('/api/admin/claims/quick-action', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id, action }),
    })

  if (status === 'approved') {
    const resend = async (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (await run(() => send('resend-setup'))) setResent(true)
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
        {resent ? (
          <span style={{ fontSize: 11, color: '#2f8d73' }}>Setup email sent</span>
        ) : (
          <button type="button" disabled={busy} onClick={resend} style={approveStyle}>
            Resend setup email
          </button>
        )}
        {error && <span style={errorStyle}>{error}</span>}
      </span>
    )
  }

  if (status !== 'new') return null

  async function act(e: MouseEvent, action: 'approve' | 'reject') {
    e.preventDefault()
    e.stopPropagation()
    const ok = await run(() => send(action))
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
