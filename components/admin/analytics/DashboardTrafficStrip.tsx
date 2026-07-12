'use client'

import { useAnalyticsFetch } from './useAnalyticsFetch'
import { Sparkline, MINT } from './charts'
import type { SummaryResponse } from './types'

/** Compact 7-day pageviews strip for the dashboard home. Renders nothing on error/empty. */
export function DashboardTrafficStrip() {
  const { data, loading, error } = useAnalyticsFetch<SummaryResponse>('/api/admin/analytics/summary?days=7')

  if (loading || error || !data) return null
  if (data.totals.pageviews === 0) return null

  return (
    <a
      href="/admin/analytics"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '12px 16px',
        border: '1px solid var(--theme-elevation-150, #e2e8f0)',
        borderRadius: 8,
        background: 'var(--theme-elevation-50, #fff)',
        textDecoration: 'none',
        color: 'inherit',
        marginBottom: 16,
      }}
    >
      <Sparkline values={data.series.map((p) => p.pageviews)} width={120} height={32} color={MINT} />
      <div style={{ fontSize: 12.5 }}>
        <strong>{data.totals.pageviews.toLocaleString()}</strong> pageviews ·{' '}
        <strong>{data.totals.visitors.toLocaleString()}</strong> visitors
        <span style={{ opacity: 0.5 }}> — last 7 days →</span>
      </div>
    </a>
  )
}
