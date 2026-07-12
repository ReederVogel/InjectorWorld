'use client'

import { useState } from 'react'

// -- Collapsible section wrapper --------------------------------------------
export function Section({
  title,
  id,
  defaultOpen,
  danger,
  children,
}: {
  title: string
  id?: string
  defaultOpen: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div id={id} style={{ marginBottom: 16 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '12px 16px',
          background: danger
            ? 'rgba(185,28,28,0.06)'
            : 'var(--theme-elevation-100, #f1f5f9)',
          border: `1px solid ${danger ? 'rgba(185,28,28,0.25)' : 'var(--theme-elevation-150, #e2e8f0)'}`,
          borderBottom: open ? 'none' : undefined,
          borderRadius: open ? '8px 8px 0 0' : '8px',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <strong style={{ fontSize: 14, color: danger ? '#B91C1C' : 'inherit' }}>{title}</strong>
        <span style={{ fontSize: 11, opacity: 0.55, fontWeight: 500, letterSpacing: '0.04em' }}>
          {open ? '▲ collapse' : '▼ expand'}
        </span>
      </button>
      {open && (
        <div
          style={{
            border: `1px solid ${danger ? 'rgba(185,28,28,0.25)' : 'var(--theme-elevation-150, #e2e8f0)'}`,
            borderTop: 'none',
            borderRadius: '0 0 8px 8px',
            padding: '16px 16px 0',
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}
