'use client'

import { useCounts } from './useCounts'
import { StatChip } from './StatChip'
import { ListHeader } from './ListHeader'

const BASE = '/admin/collections/qa'

export function QAListHeader() {
  const { counts } = useCounts([
    { key: 'total', collection: 'qa' },
    { key: 'new', collection: 'qa', where: { status: { equals: 'new' } } },
    { key: 'answered', collection: 'qa', where: { status: { equals: 'answered' } } },
    { key: 'rejected', collection: 'qa', where: { status: { equals: 'rejected' } } },
  ])

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
          <StatChip label="Answered" count={counts.answered} href={`${BASE}?where[status][equals]=answered`} tone="success" />
          <StatChip label="Rejected" count={counts.rejected} href={`${BASE}?where[status][equals]=rejected`} />
        </>
      }
    />
  )
}
