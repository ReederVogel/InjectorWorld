'use client'

import { useEffect, useState } from 'react'

type UsageData = {
  monthlySpendUsd: number
  dailySpend: { day: string; costUsd: number }[]
  topQueries: { query: string; costUsd: number; tokensIn: number; tokensOut: number; createdAt: string }[]
  flagged: { query: string; costUsd: number; createdAt: string }[]
}

const listStyle: React.CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }
const rowStyle: React.CSSProperties = { fontSize: 13, borderBottom: '1px solid var(--theme-elevation-100, #f1f5f9)', paddingBottom: 8 }
const metaStyle: React.CSSProperties = { fontSize: 11, opacity: 0.55, marginTop: 2 }

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s
}

/** Read-only usage/cost dashboard for the AI assistant, backed by /api/admin/assistant-usage. */
export function AssistantUsagePanel() {
  const [data, setData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/assistant-usage', { credentials: 'include' })
      .then((res) => res.json())
      .then(setData)
      .catch(() => { /* non-fatal, shows the fallback message below */ })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p style={{ fontSize: 13, opacity: 0.7 }}>Loading…</p>
  if (!data) return <p style={{ fontSize: 13, opacity: 0.7 }}>Could not load usage data.</p>

  const maxDaily = Math.max(1, ...data.dailySpend.map((d) => d.costUsd))

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <strong style={{ fontSize: 22 }}>${data.monthlySpendUsd.toFixed(2)}</strong>
        <span style={{ fontSize: 12, opacity: 0.65, marginLeft: 8 }}>spent this month</span>
      </div>

      {data.dailySpend.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, marginBottom: 8 }}>Daily spend this month</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 60 }}>
            {data.dailySpend.map((d) => (
              <div
                key={d.day}
                title={`${new Date(d.day).toLocaleDateString()}: $${d.costUsd.toFixed(2)}`}
                style={{
                  flex: 1,
                  minWidth: 4,
                  height: `${Math.max(4, (d.costUsd / maxDaily) * 60)}px`,
                  background: '#3FA68A',
                  borderRadius: 2,
                }}
              />
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, marginBottom: 8 }}>Top queries by cost</div>
          {data.topQueries.length === 0 ? (
            <p style={{ fontSize: 13, opacity: 0.6 }}>No exchanges logged yet.</p>
          ) : (
            <ul style={listStyle}>
              {data.topQueries.map((q, i) => (
                <li key={i} style={rowStyle}>
                  <div style={{ opacity: 0.85 }}>{truncate(q.query, 80)}</div>
                  <div style={metaStyle}>
                    ${q.costUsd.toFixed(4)} · {q.tokensIn + q.tokensOut} tokens · {new Date(q.createdAt).toLocaleDateString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, marginBottom: 8 }}>Flagged exchanges</div>
          {data.flagged.length === 0 ? (
            <p style={{ fontSize: 13, opacity: 0.6 }}>Nothing flagged.</p>
          ) : (
            <ul style={listStyle}>
              {data.flagged.map((f, i) => (
                <li key={i} style={rowStyle}>
                  <div style={{ opacity: 0.85, color: '#B91C1C' }}>{truncate(f.query, 80)}</div>
                  <div style={metaStyle}>
                    ${f.costUsd.toFixed(4)} · {new Date(f.createdAt).toLocaleDateString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
