'use client'

import { useState } from 'react'
import { useAnalyticsFetch } from './useAnalyticsFetch'
import { RangePicker } from './RangePicker'
import { KpiRow } from './KpiRow'
import { TrafficPanel } from './TrafficPanel'
import { FunnelPanel } from './FunnelPanel'
import { TopPagesPanel } from './TopPagesPanel'
import { TopClinicsPanel } from './TopClinicsPanel'
import { AudiencePanel } from './AudiencePanel'
import type { FunnelResponse, RangeDays, SummaryResponse, TopResponse } from './types'

/**
 * Client container for /admin/analytics. Owns the shared range picker and
 * three fetches (summary, top, funnel) so panels sourced from the same
 * endpoint don't each re-fetch it -- KPI row + Traffic panel share summary,
 * Top pages + Top clinics + Audience share top, Funnel owns its own.
 * A failure in one fetch only blanks the panels that depend on it.
 */
export function AnalyticsDashboard() {
  const [range, setRange] = useState<RangeDays>(30)

  const summary = useAnalyticsFetch<SummaryResponse>(`/api/admin/analytics/summary?days=${range}`)
  const top = useAnalyticsFetch<TopResponse>(`/api/admin/analytics/top?days=${range}`)
  const funnel = useAnalyticsFetch<FunnelResponse>(`/api/admin/analytics/funnel?days=${range}`)

  return (
    <div>
      <RangePicker value={range} onChange={setRange} />

      <KpiRow data={summary.data} loading={summary.loading} error={summary.error} />

      <TrafficPanel data={summary.data} loading={summary.loading} error={summary.error} />

      <FunnelPanel data={funnel.data} loading={funnel.loading} error={funnel.error} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <TopPagesPanel data={top.data} loading={top.loading} error={top.error} />
        <TopClinicsPanel data={top.data} loading={top.loading} error={top.error} />
      </div>

      <AudiencePanel data={top.data} loading={top.loading} error={top.error} />
    </div>
  )
}
