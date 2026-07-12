'use client'

import { box } from '../ui/styles'

/**
 * Shared loading/empty/error wrapper for a single analytics panel. Each panel
 * fetches its own endpoint, so one failing panel renders its own error state
 * here instead of blanking the rest of the dashboard.
 */
export function PanelFrame({
  title,
  loading,
  error,
  empty,
  emptyLabel = 'No data yet for this range.',
  children,
}: {
  title: string
  loading: boolean
  error?: string | null
  empty?: boolean
  emptyLabel?: string
  children: React.ReactNode
}) {
  return (
    <div style={box}>
      <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600 }}>{title}</h3>
      {loading ? (
        <Skeleton />
      ) : error ? (
        <p style={{ fontSize: 12.5, color: '#B91C1C', margin: 0 }}>{error}</p>
      ) : empty ? (
        <p style={{ fontSize: 12.5, opacity: 0.55, margin: 0 }}>{emptyLabel}</p>
      ) : (
        children
      )}
    </div>
  )
}

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            height: 14,
            borderRadius: 4,
            background: 'var(--theme-elevation-100, #f1f5f9)',
            width: `${90 - i * 15}%`,
          }}
        />
      ))}
    </div>
  )
}
