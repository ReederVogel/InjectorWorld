'use client'

import { useCounts } from './useCounts'
import { StatChip } from './StatChip'
import { ListHeader } from './ListHeader'

const BASE = '/admin/collections/guides'

export function GuidesListHeader() {
  const { counts } = useCounts([
    { key: 'total', collection: 'guides' },
    { key: 'published', collection: 'guides', where: { status: { equals: 'published' } } },
    { key: 'draft', collection: 'guides', where: { status: { equals: 'draft' } } },
    { key: 'no_reviewer', collection: 'guides', where: { medicalReviewer: { exists: false } } },
  ])

  return (
    <ListHeader
      chips={
        <>
          <StatChip label="Total" count={counts.total} href={BASE} />
          <StatChip label="Published" count={counts.published} href={`${BASE}?where[status][equals]=published`} tone="success" />
          <StatChip label="Draft" count={counts.draft} href={`${BASE}?where[status][equals]=draft`} />
          <StatChip
            label="No medical reviewer"
            count={counts.no_reviewer}
            href={`${BASE}?where[medicalReviewer][exists]=false`}
            tone={counts.no_reviewer ? 'warn' : 'default'}
          />
        </>
      }
    />
  )
}
