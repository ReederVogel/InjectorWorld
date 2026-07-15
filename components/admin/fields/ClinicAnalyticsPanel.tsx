'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import { useAnalyticsFetch } from '../analytics/useAnalyticsFetch'
import { Sparkline, MINT } from '../analytics/charts'
import type { ClinicAnalyticsResponse } from '../analytics/types'

/**
 * Sidebar field for the clinic edit view. Renders null on the create view
 * (no id yet) or when the fetch 404s/500s -- a clinic with no analytics data
 * should not show a broken-looking panel.
 */
export function ClinicAnalyticsPanel() {
  const { id } = useDocumentInfo()
  return id ? <PanelBody id={id} /> : null
}

function PanelBody({ id }: { id: string | number }) {
  const { data, loading, error } = useAnalyticsFetch<ClinicAnalyticsResponse>(
    `/api/admin/analytics/clinic/${id}?days=30`,
  )

  if (loading) {
    return (
      <div style={wrapStyle}>
        <span style={{ fontSize: 12, opacity: 0.5 }}>Loading analytics…</span>
      </div>
    )
  }

  if (error || !data) return null

  return (
    <div style={wrapStyle}>
      <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.6, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Analytics (30 days)
      </div>
      <Sparkline values={data.series.map((p) => p.views)} width={200} height={36} color={MINT} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
        <Stat label="Views" value={data.viewsTotal} />
        <Stat label="Leads" value={data.leads} />
        <Stat label="Bookings opened" value={data.bookingOpen} />
        <Stat label="Contact revealed" value={data.contactReveal} />
        <Stat label="Shares" value={data.share ?? 0} />
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>{value.toLocaleString()}</div>
      <div style={{ fontSize: 10.5, opacity: 0.55 }}>{label}</div>
    </div>
  )
}

const wrapStyle: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150, #e2e8f0)',
  borderRadius: 8,
  padding: 14,
  background: 'var(--theme-elevation-50, #fff)',
}
