'use client'

import type { SummaryResponse } from './types'

function fmt(n: number): string {
  return n.toLocaleString()
}

export function KpiRow({
  data,
  loading,
  error,
}: {
  data: SummaryResponse | null
  loading: boolean
  error: string | null
}) {
  const totals = data?.totals
  const today = data?.todaySoFar
  const cards = [
    { label: 'Pageviews', value: totals?.pageviews },
    { label: 'Unique visitors', value: totals?.visitors },
    { label: 'Clinic views', value: totals?.clinicViews },
    { label: 'Leads submitted', value: totals?.leads },
  ]

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
      {cards.map((c) => (
        <div
          key={c.label}
          style={{
            flex: '1 1 150px',
            padding: '14px 16px',
            border: '1px solid var(--theme-elevation-150, #e2e8f0)',
            borderRadius: 8,
            background: 'var(--theme-elevation-50, #fff)',
          }}
        >
          <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1 }}>
            {loading ? '…' : error ? '—' : fmt(c.value ?? 0)}
          </div>
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>{c.label}</div>
        </div>
      ))}
      <div
        style={{
          flex: '1 1 150px',
          padding: '14px 16px',
          borderRadius: 8,
          border: '1px solid rgba(63,166,138,0.3)',
          background: 'rgba(63,166,138,0.06)',
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1, color: '#3FA68A' }}>
          {loading ? '…' : error ? '—' : fmt(today?.pageviews ?? 0)}
        </div>
        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
          Pageviews today so far ({loading || error ? '…' : fmt(today?.visitors ?? 0)} visitors)
        </div>
      </div>
      {error && (
        <div style={{ flexBasis: '100%', fontSize: 12, color: '#B91C1C' }}>{error}</div>
      )}
    </div>
  )
}
