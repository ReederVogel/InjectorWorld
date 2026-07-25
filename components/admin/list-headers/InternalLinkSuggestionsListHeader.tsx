'use client'

import { useCounts } from './useCounts'
import { StatChip } from './StatChip'
import { ListHeader } from './ListHeader'

const BASE = '/admin/collections/internal-link-suggestions'

export function InternalLinkSuggestionsListHeader() {
  const { counts } = useCounts([
    { key: 'pending', collection: 'internal-link-suggestions', where: { status: { equals: 'pending' } } },
    { key: 'approved', collection: 'internal-link-suggestions', where: { status: { equals: 'approved' } } },
    { key: 'rejected', collection: 'internal-link-suggestions', where: { status: { equals: 'rejected' } } },
    {
      key: 'failed',
      collection: 'internal-link-suggestions',
      where: { status: { equals: 'approved' }, errorMessage: { exists: true } },
    },
  ])

  return (
    <ListHeader
      chips={
        <>
          <StatChip
            label="Pending review"
            count={counts.pending}
            href={`${BASE}?where[status][equals]=pending`}
            tone={counts.pending ? 'warn' : 'default'}
          />
          <StatChip label="Approved" count={counts.approved} href={`${BASE}?where[status][equals]=approved`} tone="success" />
          <StatChip label="Rejected" count={counts.rejected} href={`${BASE}?where[status][equals]=rejected`} />
          <StatChip
            label="Approved but failed to insert"
            count={counts.failed}
            href={`${BASE}?where[status][equals]=approved`}
            tone={counts.failed ? 'danger' : 'default'}
          />
        </>
      }
    />
  )
}
