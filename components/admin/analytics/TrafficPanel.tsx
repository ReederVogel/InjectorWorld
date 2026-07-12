'use client'

import { PanelFrame } from './PanelFrame'
import { DualLineChart } from './charts'
import type { SummaryResponse } from './types'

function shortDay(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${m}/${d}`
}

export function TrafficPanel({
  data,
  loading,
  error,
}: {
  data: SummaryResponse | null
  loading: boolean
  error: string | null
}) {
  const series = data?.series ?? []
  const empty = !loading && !error && series.every((p) => p.pageviews === 0 && p.visitors === 0)

  return (
    <PanelFrame title="Traffic" loading={loading} error={error} empty={empty}>
      <DualLineChart
        data={series.map((p) => ({ label: shortDay(p.day), a: p.pageviews, b: p.visitors }))}
        aLabel="Pageviews"
        bLabel="Visitors"
      />
    </PanelFrame>
  )
}
