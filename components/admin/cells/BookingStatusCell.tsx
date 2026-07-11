'use client'

import { useState } from 'react'
import { Badge, type Tone } from './Badge'
import { BookingQuickActions } from '../quick-actions/BookingQuickActions'

const MAP: Record<string, { label: string; tone: Tone }> = {
  new: { label: 'New', tone: 'amber' },
  confirmed: { label: 'Confirmed', tone: 'blue' },
  completed: { label: 'Completed', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'grey' },
  no_show: { label: 'No-show', tone: 'red' },
}

/**
 * List cell for Bookings.status. For unactioned ("new") leads it appends how
 * long the lead has waited so stale ones are obvious at a glance, plus
 * inline Confirm/Cancel buttons.
 */
export function BookingStatusCell(props: any) {
  const initial: string = props?.cellData ?? props?.rowData?.status ?? ''
  const [status, setStatus] = useState(initial)
  const id = props?.rowData?.id
  const m = MAP[status]
  if (!m) return <span>{status || '—'}</span>

  let suffix: string | undefined
  if (status === 'new') {
    const created = props?.rowData?.createdAt
    if (created) {
      const days = Math.floor((Date.now() - new Date(created).getTime()) / 86400000)
      if (days >= 1) suffix = `${days}d waiting`
    }
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      <Badge label={m.label} tone={m.tone} suffix={suffix} />
      {id != null && <BookingQuickActions id={id} status={status} onDone={setStatus} />}
    </span>
  )
}
