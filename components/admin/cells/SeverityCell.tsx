'use client'

import { Badge, type Tone } from './Badge'

const MAP: Record<string, { label: string; tone: Tone }> = {
  error: { label: 'Error', tone: 'red' },
  warning: { label: 'Warning', tone: 'amber' },
  info: { label: 'Info', tone: 'grey' },
}

/** List cell for DataAlerts.severity. */
export function SeverityCell(props: any) {
  const value: string = props?.cellData ?? props?.rowData?.severity ?? ''
  const m = MAP[value]
  if (!m) return <span>{value || '—'}</span>
  return <Badge label={m.label} tone={m.tone} />
}
