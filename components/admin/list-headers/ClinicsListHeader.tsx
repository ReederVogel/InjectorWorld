'use client'

import { useCounts } from './useCounts'
import { StatChip } from './StatChip'
import { ListHeader } from './ListHeader'

const BASE = '/admin/collections/clinics'

export function ClinicsListHeader() {
  const { counts } = useCounts([
    { key: 'total', collection: 'clinics' },
    { key: 'published', collection: 'clinics', where: { status: { equals: 'published' } } },
    { key: 'review', collection: 'clinics', where: { status: { equals: 'review' } } },
    { key: 'draft', collection: 'clinics', where: { status: { equals: 'draft' } } },
    { key: 'noindexed', collection: 'clinics', where: { noindex: { equals: true } } },
  ])

  return (
    <ListHeader
      chips={
        <>
          <StatChip label="Total" count={counts.total} href={BASE} />
          <StatChip label="Published" count={counts.published} href={`${BASE}?where[status][equals]=published`} tone="success" />
          <StatChip label="Review" count={counts.review} href={`${BASE}?where[status][equals]=review`} tone="warn" />
          <StatChip label="Draft" count={counts.draft} href={`${BASE}?where[status][equals]=draft`} />
          <StatChip label="Noindexed" count={counts.noindexed} href={`${BASE}?where[noindex][equals]=true`} />
        </>
      }
    />
  )
}
