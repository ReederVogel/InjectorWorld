'use client'

import { useState } from 'react'
import { Badge, type Tone } from './Badge'
import { ClaimQuickActions } from '../quick-actions/ClaimQuickActions'

const MAP: Record<string, { label: string; tone: Tone }> = {
  new: { label: 'New', tone: 'amber' },
  approved: { label: 'Approved', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'grey' },
}

/** List cell for Claims.status, with inline Approve/Reject for `new` claims. */
export function ClaimStatusCell(props: any) {
  const initial: string = props?.cellData ?? props?.rowData?.status ?? ''
  const [status, setStatus] = useState(initial)
  const id = props?.rowData?.id
  const m = MAP[status]
  if (!m) return <span>{status || '—'}</span>
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      <Badge label={m.label} tone={m.tone} />
      {id != null && <ClaimQuickActions id={id} status={status} onDone={setStatus} />}
    </span>
  )
}
