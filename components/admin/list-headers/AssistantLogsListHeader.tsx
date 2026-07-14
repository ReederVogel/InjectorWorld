'use client'

import { useCounts } from './useCounts'
import { StatChip } from './StatChip'
import { ListHeader } from './ListHeader'
import { AssistantUsagePanel } from '../AssistantUsagePanel'

const BASE = '/admin/collections/assistant-logs'

export function AssistantLogsListHeader() {
  const { counts } = useCounts([
    { key: 'total', collection: 'assistant-logs' },
    { key: 'flagged', collection: 'assistant-logs', where: { flagged: { equals: true } } },
  ])

  return (
    <ListHeader
      chips={
        <>
          <StatChip label="Total" count={counts.total} href={BASE} />
          <StatChip
            label="Flagged"
            count={counts.flagged}
            href={`${BASE}?where[flagged][equals]=true`}
            tone={counts.flagged ? 'warn' : 'default'}
          />
        </>
      }
      extra={
        <div style={{ border: '1px solid #0B1B341f', borderRadius: 8, padding: 14, background: '#fff' }}>
          <AssistantUsagePanel />
        </div>
      }
    />
  )
}
