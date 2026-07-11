'use client'

import type { MouseEvent } from 'react'
import { useQuickAction } from './useQuickAction'
import { approveStyle, errorStyle } from './ClaimQuickActions'

type Props = {
  id: number | string
  status: string
  onDone: (newStatus: string) => void
}

/**
 * Inline Acknowledge/Resolve buttons for a data alert. `open` shows both
 * (an operator may resolve directly without a separate acknowledge step);
 * `acknowledged` shows Resolve only; `resolved` renders nothing.
 */
export function AlertQuickActions({ id, status, onDone }: Props) {
  const { busy, error, run } = useQuickAction()

  if (status !== 'open' && status !== 'acknowledged') return null

  async function act(e: MouseEvent, action: 'acknowledge' | 'resolve') {
    e.preventDefault()
    e.stopPropagation()
    const ok = await run(() =>
      fetch('/api/admin/data-alerts/quick-action', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, action }),
      }),
    )
    if (ok) onDone(action === 'acknowledge' ? 'acknowledged' : 'resolved')
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
      {status === 'open' && (
        <button type="button" disabled={busy} onClick={(e) => act(e, 'acknowledge')} style={neutralStyle}>
          Acknowledge
        </button>
      )}
      <button type="button" disabled={busy} onClick={(e) => act(e, 'resolve')} style={approveStyle}>
        Resolve
      </button>
      {error && <span style={errorStyle}>{error}</span>}
    </span>
  )
}

const neutralStyle = {
  fontSize: 11,
  fontWeight: 600,
  padding: '2px 8px',
  borderRadius: 999,
  background: 'transparent',
  cursor: 'pointer',
  lineHeight: '16px',
  border: '1px solid #64748b',
  color: '#64748b',
} as const
