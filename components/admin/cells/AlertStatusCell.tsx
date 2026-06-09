'use client'

import { Badge, type Tone } from './Badge'

const MAP: Record<string, { label: string; tone: Tone }> = {
  open: { label: 'Open', tone: 'amber' },
  acknowledged: { label: 'Acknowledged', tone: 'blue' },
  resolved: { label: 'Resolved', tone: 'green' },
}

/** List cell for DataAlerts.status. */
export function AlertStatusCell(props: any) {
  const value: string = props?.cellData ?? props?.rowData?.status ?? ''
  const m = MAP[value]
  if (!m) return <span>{value || '—'}</span>
  return <Badge label={m.label} tone={m.tone} />
}
