'use client'

import { Badge, type Tone } from './Badge'

const MAP: Record<string, { label: string; tone: Tone }> = {
  new: { label: 'New', tone: 'amber' },
  confirmed: { label: 'Confirmed', tone: 'blue' },
  completed: { label: 'Completed', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'grey' },
  no_show: { label: 'No-show', tone: 'red' },
}

/**
 * List cell for Bookings.status. For unactioned ("new") leads it appends how
 * long the lead has waited so stale ones are obvious at a glance.
 */
export function BookingStatusCell(props: any) {
  const value: string = props?.cellData ?? props?.rowData?.status ?? ''
  const m = MAP[value]
  if (!m) return <span>{value || '—'}</span>

  let suffix: string | undefined
  if (value === 'new') {
    const created = props?.rowData?.createdAt
    if (created) {
      const days = Math.floor((Date.now() - new Date(created).getTime()) / 86400000)
      if (days >= 1) suffix = `${days}d waiting`
    }
  }
  return <Badge label={m.label} tone={m.tone} suffix={suffix} />
}
