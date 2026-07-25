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

const primaryBtn: React.CSSProperties = {
  padding: '7px 14px',
  borderRadius: 999,
  border: '1px solid #0B1B34',
  background: '#0B1B34',
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}

export function ContentReportPanel() {
  const [data, setData] = useState<ReportData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  async function exportToExcel() {
    setExporting(true)
    setExportError('')
    try {
      const res = await fetch('/api/admin/content-report/export', { credentials: 'include' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setExportError(body.error || `Export failed (${res.status}).`)
        return
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename="([^"]+)"/)
      const filename = match?.[1] || `content-report-${new Date().toISOString().slice(0, 10)}.xlsx`
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      setExportError('Network error while exporting.')
    } finally {
      setExporting(false)
    }
  }

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, opacity: 0.65 }}>
          Exports live URLs for Clinics/Guides/News/Brands, and full FAQ content, as one .xlsx workbook.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {exportError && <span style={{ fontSize: 12, color: '#B91C1C', fontWeight: 600 }}>{exportError}</span>}
          <button type="button" style={primaryBtn} onClick={exportToExcel} disabled={exporting}>
            {exporting ? 'Exporting…' : 'Export to Excel'}
          </button>
        </div>
      </div>

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
        <div>Live-state field per collection: Clinics use <code>status = &quot;published&quot;</code>; Guides/News/FAQs use <code>reviewStatus = &quot;approved&quot;</code> (their admin &quot;status&quot; field is not the real gate — it was never backfilled for existing content); Brands has no draft/published concept — every brand is live once created.</div>
        <div style={{ marginTop: 6 }}>Generated {new Date(data.generatedAt).toLocaleString()}</div>
      </div>
    </div>
  )
}
