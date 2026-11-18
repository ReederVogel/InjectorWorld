'use client'

import { useEffect, useState } from 'react'
import { fetchOldestPendingDays, useCounts } from './useCounts'
import { StatChip } from './StatChip'
import { ListHeader } from './ListHeader'

const BASE = '/admin/collections/listing-reports'

export function ListingReportsListHeader() {
  const { counts } = useCounts([
    { key: 'total', collection: 'listing-reports' },
    { key: 'new', collection: 'listing-reports', where: { status: { equals: 'new' } } },
    { key: 'in_review', collection: 'listing-reports', where: { status: { equals: 'in_review' } } },
    { key: 'fixed', collection: 'listing-reports', where: { status: { equals: 'fixed' } } },
    { key: 'dismissed', collection: 'listing-reports', where: { status: { equals: 'dismissed' } } },
  ])

  const [oldestDays, setOldestDays] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchOldestPendingDays('listing-reports', { status: { equals: 'new' } }).then((days) => {
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
          <StatChip
            label="New"
            count={counts.new}
            href={`${BASE}?where[status][equals]=new`}
            tone={counts.new ? 'danger' : 'default'}
          />
          <StatChip label="In review" count={counts.in_review} href={`${BASE}?where[status][equals]=in_review`} />
          <StatChip label="Fixed" count={counts.fixed} href={`${BASE}?where[status][equals]=fixed`} tone="success" />
          <StatChip label="Dismissed" count={counts.dismissed} href={`${BASE}?where[status][equals]=dismissed`} />
          <StatChip label="Total" count={counts.total} href={BASE} />
          {oldestDays != null && (
            <StatChip
              label="Oldest waiting"
              count={oldestDays}
              suffix={oldestDays === 1 ? ' day' : ' days'}
              tone={oldestDays > 3 ? 'danger' : 'default'}
            />
          )}
        </>
      }
    />
  )
}
