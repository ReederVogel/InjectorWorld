'use client'

import { useEffect, useState } from 'react'
import { fetchOldestPendingDays, useCounts } from './useCounts'
import { StatChip } from './StatChip'
import { ListHeader } from './ListHeader'

const BASE = '/admin/collections/claims'

export function ClaimsListHeader() {
  const { counts } = useCounts([
    { key: 'total', collection: 'claims' },
    { key: 'new', collection: 'claims', where: { status: { equals: 'new' } } },
    { key: 'approved', collection: 'claims', where: { status: { equals: 'approved' } } },
    { key: 'rejected', collection: 'claims', where: { status: { equals: 'rejected' } } },
  ])

  const [oldestDays, setOldestDays] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchOldestPendingDays('claims', { status: { equals: 'new' } }).then((days) => {
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
          <StatChip label="Approved" count={counts.approved} href={`${BASE}?where[status][equals]=approved`} tone="success" />
          <StatChip label="Rejected" count={counts.rejected} href={`${BASE}?where[status][equals]=rejected`} />
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
