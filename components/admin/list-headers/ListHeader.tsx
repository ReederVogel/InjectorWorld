'use client'

import type { ReactNode } from 'react'

export function ListHeader({
  title,
  chips,
  extra,
}: {
  title?: string
  chips: ReactNode
  extra?: ReactNode
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      {title && (
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            opacity: 0.6,
            marginBottom: 8,
          }}
        >
          {title}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>{chips}</div>
      {extra && <div style={{ marginTop: 10 }}>{extra}</div>}
    </div>
  )
}
