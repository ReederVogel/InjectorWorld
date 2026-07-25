'use client'

import { useEffect, useState } from 'react'

type CollectionStat = {
  total: number
  rawRows?: number
  published: number
  statusField: string | null
  liveValue: string | null
  note?: string
}

type ReportData = {
  generatedAt: string
  collections: {
    clinics: CollectionStat
    guides: CollectionStat
    news: CollectionStat
    faqs: CollectionStat
    brands: CollectionStat
  }
}

const ROWS: { key: keyof ReportData['collections']; label: string }[] = [
  { key: 'clinics', label: 'Clinics' },
  { key: 'guides', label: 'Guides' },
  { key: 'news', label: 'News' },
  { key: 'faqs', label: 'FAQs' },
  { key: 'brands', label: 'Brands' },
]

const box: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150, #e2e8f0)',
  borderRadius: 12,
  background: 'var(--theme-elevation-0, #fff)',
  padding: 16,
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  opacity: 0.6,
  fontWeight: 600,
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const td: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 14,
  borderTop: '1px solid var(--theme-elevation-100, #eef1f5)',
}

export function ContentReportPanel() {
  const [data, setData] = useState<ReportData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch('/api/admin/content-report', { credentials: 'include' })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          if (!cancelled) setError(body.error || `Failed to load (${res.status}).`)
          return
        }
        if (!cancelled) setData(body)
      } catch {
        if (!cancelled) setError('Network error while loading the report.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return <div style={box}>Loading content report…</div>
  }

  if (error) {
    return <div style={{ ...box, color: '#B91C1C' }}>{error}</div>
  }

  if (!data) return null

  return (
    <div style={box}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={th}>Collection</th>
              <th style={th}>Total documents</th>
              <th style={th}>Published / live</th>
              <th style={th}>% published</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(({ key, label }) => {
              const stat = data.collections[key]
              const pct = stat.total > 0 ? Math.round((stat.published / stat.total) * 100) : 0
              return (
                <tr key={key}>
                  <td style={{ ...td, fontWeight: 600 }}>{label}</td>
                  <td style={td}>
                    {stat.total.toLocaleString()}
                    {key === 'clinics' && stat.rawRows != null && stat.rawRows !== stat.total && (
                      <span style={{ opacity: 0.6, fontSize: 12 }}> ({stat.rawRows.toLocaleString()} raw rows)</span>
                    )}
                  </td>
                  <td style={td}>{stat.published.toLocaleString()}</td>
                  <td style={td}>{pct}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 14, fontSize: 12, opacity: 0.65, lineHeight: 1.6 }}>
        <div>Clinics total is deduped by slug (unique pages) — each clinic&apos;s slug carries its own DB unique constraint, so this is the true page count, not raw row count.</div>
        <div>Live-state field per collection: Clinics/Guides/News use <code>status = &quot;published&quot;</code>; FAQs use <code>reviewStatus = &quot;approved&quot;</code>; Brands has no draft/published concept — every brand is live once created.</div>
        <div style={{ marginTop: 6 }}>Generated {new Date(data.generatedAt).toLocaleString()}</div>
      </div>
    </div>
  )
}
