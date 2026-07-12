'use client'

import { PanelFrame } from './PanelFrame'
import type { FunnelResponse } from './types'

const STAGES: { key: keyof FunnelResponse['sessions']; label: string }[] = [
  { key: 'total', label: 'Sessions' },
  { key: 'clinicView', label: 'Viewed a clinic' },
  { key: 'bookingOpen', label: 'Opened booking form' },
  { key: 'bookingSubmit', label: 'Submitted booking' },
]

export function FunnelPanel({
  data,
  loading,
  error,
}: {
  data: FunnelResponse | null
  loading: boolean
  error: string | null
}) {
  const sessions = data?.sessions
  const empty = !loading && !error && (!sessions || sessions.total === 0)

  return (
    <PanelFrame title="Booking funnel" loading={loading} error={error} empty={empty}>
      {sessions && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {STAGES.map((stage, i) => {
            const value = sessions[stage.key]
            const pct = sessions.total > 0 ? Math.round((value / sessions.total) * 100) : 0
            const prevValue = i > 0 ? sessions[STAGES[i - 1].key] : value
            const dropoff = i > 0 && prevValue > 0 ? Math.round(((prevValue - value) / prevValue) * 100) : 0
            return (
              <div key={stage.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                  <span>{stage.label}</span>
                  <span>
                    <strong>{value.toLocaleString()}</strong>
                    <span style={{ opacity: 0.55 }}> ({pct}% of sessions)</span>
                    {i > 0 && dropoff > 0 && (
                      <span style={{ color: '#B91C1C', marginLeft: 8 }}>-{dropoff}%</span>
                    )}
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: 'var(--theme-elevation-100, #f1f5f9)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: '#0B1B34' }} />
                </div>
              </div>
            )
          })}
          <p style={{ fontSize: 11.5, opacity: 0.55, margin: '4px 0 0' }}>
            Contact info revealed in {sessions.contactReveal.toLocaleString()} session
            {sessions.contactReveal === 1 ? '' : 's'}.
          </p>
        </div>
      )}
    </PanelFrame>
  )
}
