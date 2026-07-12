'use client'

import { PanelFrame } from './PanelFrame'
import { BarList } from './charts'
import type { TopResponse } from './types'

export function TopPagesPanel({
  data,
  loading,
  error,
}: {
  data: TopResponse | null
  loading: boolean
  error: string | null
}) {
  const rows = data?.topPaths ?? []
  const empty = !loading && !error && rows.length === 0

  return (
    <PanelFrame title="Top pages" loading={loading} error={error} empty={empty}>
      <BarList
        rows={rows.map((r) => ({ label: r.path, value: r.views, href: r.path }))}
        color="#0B1B34"
      />
    </PanelFrame>
  )
}
