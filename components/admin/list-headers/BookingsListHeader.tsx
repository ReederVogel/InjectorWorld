'use client'

import { useEffect, useState } from 'react'
import { fetchOldestPendingDays, useCounts } from './useCounts'
import { StatChip } from './StatChip'
import { ListHeader } from './ListHeader'

const BASE = '/admin/collections/bookings'

export function BookingsListHeader() {
  const { counts } = useCounts([
    { key: 'total', collection: 'bookings' },
    { key: 'new', collection: 'bookings', where: { status: { equals: 'new' } } },
    { key: 'confirmed', collection: 'bookings', where: { status: { equals: 'confirmed' } } },
    { key: 'completed', collection: 'bookings', where: { status: { equals: 'completed' } } },
    { key: 'cancelled', collection: 'bookings', where: { status: { equals: 'cancelled' } } },
    { key: 'no_show', collection: 'bookings', where: { status: { equals: 'no_show' } } },
  ])

  const [oldestDays, setOldestDays] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchOldestPendingDays('bookings', { status: { equals: 'new' } }).then((days) => {
      if (!cancelled) setOldestDays(days)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <ListHeader
      chips={
        <>
          <StatChip label="Total" count={counts.total} href={BASE} />
          <StatChip
            label="New"
            count={counts.new}
            href={`${BASE}?where[status][equals]=new`}
            tone={counts.new ? 'danger' : 'default'}
          />
          <StatChip label="Confirmed" count={counts.confirmed} href={`${BASE}?where[status][equals]=confirmed`} />
          <StatChip label="Completed" count={counts.completed} href={`${BASE}?where[status][equals]=completed`} tone="success" />
          <StatChip label="Cancelled" count={counts.cancelled} href={`${BASE}?where[status][equals]=cancelled`} />
          <StatChip label="No-show" count={counts.no_show} href={`${BASE}?where[status][equals]=no_show`} />
        </>
      }
      extra={
        oldestDays != null ? (
          <StatChip
            label="Oldest waiting"
            count={oldestDays}
            suffix={oldestDays === 1 ? ' day' : ' days'}
            tone={oldestDays > 3 ? 'danger' : 'default'}
          />
        ) : undefined
      }
    />
  )
}
