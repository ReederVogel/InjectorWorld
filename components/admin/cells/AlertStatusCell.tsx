'use client'

import { useState } from 'react'
import { Badge, type Tone } from './Badge'
import { AlertQuickActions } from '../quick-actions/AlertQuickActions'

const MAP: Record<string, { label: string; tone: Tone }> = {
  open: { label: 'Open', tone: 'amber' },
  acknowledged: { label: 'Acknowledged', tone: 'blue' },
  resolved: { label: 'Resolved', tone: 'green' },
}

/** List cell for DataAlerts.status, with inline Acknowledge/Resolve. */
export function AlertStatusCell(props: any) {
  const initial: string = props?.cellData ?? props?.rowData?.status ?? ''
  const [status, setStatus] = useState(initial)
  const id = props?.rowData?.id
  const m = MAP[status]
  if (!m) return <span>{status || '—'}</span>
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      <Badge label={m.label} tone={m.tone} />
      {id != null && <AlertQuickActions id={id} status={status} onDone={setStatus} />}
    </span>
  )
}
