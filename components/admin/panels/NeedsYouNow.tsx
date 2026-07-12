'use client'

import { box } from '../ui/styles'
import { ClaimQuickActions } from '../quick-actions/ClaimQuickActions'
import { BookingQuickActions } from '../quick-actions/BookingQuickActions'
import { AlertQuickActions } from '../quick-actions/AlertQuickActions'
import { QAQuickAnswerInline } from '../quick-actions/QAQuickAnswerInline'

// -- Needs you now: unified queue of everything waiting on a human --------
export type QueueRecord = { id: number | string; title: string; status: string }
export type QueueKind = 'claim' | 'booking' | 'question' | 'alert'

export type QueueRow = {
  key: string
  label: string
  detail: string
  href: string
  dotColor: string
  kind: QueueKind
  records: QueueRecord[]
}

function QueueRecordActions({ kind, id, status, onDone }: {
  kind: QueueKind
  id: number | string
  status: string
  onDone: () => void
}) {
  if (kind === 'claim') return <ClaimQuickActions id={id} status={status} onDone={onDone} />
  if (kind === 'booking') return <BookingQuickActions id={id} status={status} onDone={onDone} />
  if (kind === 'alert') return <AlertQuickActions id={id} status={status} onDone={onDone} />
  return <QAQuickAnswerInline id={id} status={status} onDone={onDone} />
}

export function NeedsYouNow({ rows, onRecordDone }: {
  rows: QueueRow[]
  onRecordDone: (kind: QueueKind, id: QueueRecord['id']) => void
}) {
  return (
    <div style={box}>
      <strong style={{ fontSize: 15 }}>Needs you now</strong>
      <div style={{ fontSize: 13, opacity: 0.8, margin: '4px 0 14px' }}>
        Sorted by urgency. Act inline below, or click a row to open the full filtered queue.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {rows.map((row) => (
          <div key={row.key} style={{ borderTop: '1px solid var(--theme-elevation-100, #f1f5f9)', padding: '10px 6px' }}>
            <a
              href={row.href}
              style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.dotColor, flexShrink: 0 }} />
              <span style={{ fontSize: 14, fontWeight: 600, flexShrink: 0 }}>{row.label}</span>
              <span style={{ fontSize: 13, opacity: 0.65, flex: 1, minWidth: 0 }}>{row.detail}</span>
              <span style={{ fontSize: 13, color: '#3FA68A', fontWeight: 600, flexShrink: 0 }}>View all →</span>
            </a>
            {row.records.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, paddingLeft: 18 }}>
                {row.records.slice(0, 3).map((rec) => (
                  <div key={rec.id} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, fontSize: 13 }}>
                    <span style={{ opacity: 0.85, minWidth: 0 }}>{rec.title || `#${rec.id}`}</span>
                    <QueueRecordActions
                      kind={row.kind}
                      id={rec.id}
                      status={rec.status}
                      onDone={() => onRecordDone(row.kind, rec.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
