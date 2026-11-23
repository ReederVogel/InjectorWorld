'use client'

import { Badge } from './Badge'

const LABELS: Record<string, string> = {
  imported: 'Imported',
  'in-review': 'In review',
  approved: 'Approved',
}

/**
 * List cell for Guides/News reviewStatus. Approved is what puts an article on
 * the site (lib/guide-queries.ts, lib/news-queries.ts), so the cell says Live.
 */
export function ReviewStatusCell(props: any) {
  const value: string = props?.cellData ?? props?.rowData?.reviewStatus ?? ''
  if (value === 'approved') return <Badge label="Live" tone="green" />
  return <Badge label="Not live" tone="grey" suffix={LABELS[value] ? `· ${LABELS[value]}` : undefined} />
}
