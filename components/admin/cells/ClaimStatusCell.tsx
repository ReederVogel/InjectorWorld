'use client'

import { Badge, type Tone } from './Badge'

const MAP: Record<string, { label: string; tone: Tone }> = {
  new: { label: 'New', tone: 'amber' },
  approved: { label: 'Approved', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'grey' },
}

/** List cell for Claims.status. */
export function ClaimStatusCell(props: any) {
  const value: string = props?.cellData ?? props?.rowData?.status ?? ''
  const m = MAP[value]
  if (!m) return <span>{value || '—'}</span>
  return <Badge label={m.label} tone={m.tone} />
}
