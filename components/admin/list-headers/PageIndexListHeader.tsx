'use client'

import { useCounts } from './useCounts'
import { StatChip } from './StatChip'
import { ListHeader } from './ListHeader'
import { PAGE_TYPES } from '@/lib/markets'

const BASE = '/admin/collections/page-index'

const TYPE_LABELS: Record<string, string> = {
  'service-city': 'Service × city',
  'service-state': 'Service × state',
  'service-pillar': 'Service pillar',
  'brand-city-directory': 'Brand × city',
  'brand-state': 'Brand × state',
  'brand-pillar': 'Brand pillar',
  'city-hub': 'City hub',
  'state-hub': 'State hub',
  clinic: 'Clinics',
  guide: 'Guides',
  news: 'News',
  question: 'Questions',
  static: 'Static',
  provider: 'Providers',
}

/**
 * Filters and readouts over the url registry.
 *
 * The list view here has to be usable at ~92,000 rows, which the stock table is
 * not: the useful questions are all "how many, and which slice", and answering
 * them by hand-building where-clauses in the URL bar is not a workflow. Each chip
 * is a saved query; each page-type link scopes the table to one family.
 *
 * Deliberately read-only. Bulk changes belong in Indexing, where every action is
 * dry-run first, labelled, audit-logged and reversible. Nothing here writes.
 */
export function PageIndexListHeader() {
  const { counts } = useCounts([
    { key: 'total', collection: 'page-index' },
    { key: 'indexed', collection: 'page-index', where: { indexed: { equals: true } } },
    { key: 'queued', collection: 'page-index', where: { indexMode: { equals: 'queued' } } },
    { key: 'excluded', collection: 'page-index', where: { indexMode: { equals: 'excluded' } } },
    {
      key: 'ready',
      collection: 'page-index',
      where: {
        and: [
          { indexMode: { equals: 'queued' } },
          { publishable: { equals: true } },
          { meetsThreshold: { equals: true } },
        ],
      },
    },
    {
      key: 'below',
      collection: 'page-index',
      where: {
        and: [
          { indexMode: { equals: 'queued' } },
          { publishable: { equals: true } },
          { meetsThreshold: { equals: false } },
        ],
      },
    },
    { key: 'notPublishable', collection: 'page-index', where: { publishable: { equals: false } } },
    { key: 'untriaged', collection: 'page-index', where: { acknowledged: { equals: false } } },
  ])

  const READY_QS =
    'where[and][0][indexMode][equals]=queued' +
    '&where[and][1][publishable][equals]=true' +
    '&where[and][2][meetsThreshold][equals]=true'

  const BELOW_QS =
    'where[and][0][indexMode][equals]=queued' +
    '&where[and][1][publishable][equals]=true' +
    '&where[and][2][meetsThreshold][equals]=false'

  return (
    <ListHeader
      title="Url registry"
      chips={
        <>
          <StatChip label="All urls" count={counts.total} href={BASE} />
          <StatChip label="Indexed" count={counts.indexed} tone="success" href={`${BASE}?where[indexed][equals]=true`} />
          <StatChip label="Queued" count={counts.queued} href={`${BASE}?where[indexMode][equals]=queued`} />
          <StatChip label="Ready to batch" count={counts.ready} tone="warn" href={`${BASE}?${READY_QS}`} />
          <StatChip label="Below threshold" count={counts.below} href={`${BASE}?${BELOW_QS}`} />
          <StatChip label="Excluded" count={counts.excluded} href={`${BASE}?where[indexMode][equals]=excluded`} />
          <StatChip
            label="Nothing to show"
            count={counts.notPublishable}
            href={`${BASE}?where[publishable][equals]=false`}
          />
          <StatChip label="New, untriaged" count={counts.untriaged} href={`${BASE}?where[acknowledged][equals]=false`} />
        </>
      }
      extra={
        <div
          style={{
            border: '1px solid var(--theme-elevation-150, #e2e8f0)',
            borderRadius: 8,
            padding: 12,
            background: 'var(--theme-elevation-50, #f7f8fa)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
            <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Jump to a page type
            </span>
            <a href="/admin/indexing" style={{ fontSize: 12.5, fontWeight: 600, color: '#3FA68A', textDecoration: 'none' }}>
              Batch urls in from Indexing →
            </a>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {PAGE_TYPES.map((t) => (
              <a
                key={t}
                href={`${BASE}?where[pageType][equals]=${t}`}
                style={{
                  fontSize: 12, fontWeight: 600, textDecoration: 'none',
                  padding: '5px 11px', borderRadius: 8,
                  border: '1px solid var(--theme-elevation-150, #e2e8f0)',
                  background: 'var(--theme-elevation-0, #fff)', color: 'inherit',
                }}
              >
                {TYPE_LABELS[t] ?? t}
              </a>
            ))}
          </div>

          <p style={{ margin: '10px 0 0', fontSize: 12, opacity: 0.65, lineHeight: 1.5 }}>
            <strong>Indexed</strong> needs two things: an admin set the mode to Indexed, AND the
            url is publishable (its source doc is published, or the page has clinics behind it).
            Threshold is advisory only, so a thin page can still be indexed on purpose.
            Every field except the mode and the triage flag is written by the page scan.
          </p>
        </div>
      }
    />
  )
}
