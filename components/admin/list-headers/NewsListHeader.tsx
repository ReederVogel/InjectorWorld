'use client'

import { useCounts } from './useCounts'
import { StatChip } from './StatChip'
import { ListHeader } from './ListHeader'

const BASE = '/admin/collections/news'

export function NewsListHeader() {
  const { counts } = useCounts([
    { key: 'total', collection: 'news' },
    { key: 'published', collection: 'news', where: { status: { equals: 'published' } } },
    { key: 'draft', collection: 'news', where: { status: { equals: 'draft' } } },
  ])

  return (
    <ListHeader
      chips={
        <>
          <StatChip label="Total" count={counts.total} href={BASE} />
          <StatChip label="Published" count={counts.published} href={`${BASE}?where[status][equals]=published`} tone="success" />
          <StatChip label="Draft" count={counts.draft} href={`${BASE}?where[status][equals]=draft`} />
        </>
      }
    />
  )
}
