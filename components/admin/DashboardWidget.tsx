'use client'

import { useEffect, useState } from 'react'

type Report = {
  clinics: { created: number; updated: number; skipped: number }
  providers: { created: number; updated: number; skipped: number }
  reviews: { created: number; updated: number; skipped: number }
  alerts: Array<{ severity: string; type: string; message: string }>
}

const box: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150, #e2e8f0)',
  borderRadius: 8,
  padding: 20,
  marginBottom: 24,
  background: 'var(--theme-elevation-50, #fff)',
}

export function DashboardWidget() {
  const [openAlerts, setOpenAlerts] = useState<number | null>(null)
  const [errorAlerts, setErrorAlerts] = useState<number>(0)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Report | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  async function loadAlertCounts() {
    try {
      const [openRes, errRes] = await Promise.all([
        fetch('/api/data-alerts?where[status][equals]=open&limit=0&depth=0', { credentials: 'include' }),
        fetch('/api/data-alerts?where[status][equals]=open&where[severity][equals]=error&limit=0&depth=0', { credentials: 'include' }),
      ])
      const open = await openRes.json()
      const err = await errRes.json()
      setOpenAlerts(open.totalDocs ?? 0)
      setErrorAlerts(err.totalDocs ?? 0)
    } catch {
      setOpenAlerts(null)
    }
  }

  useEffect(() => { loadAlertCounts() }, [])

  async function handleImport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setErrorMsg('')
    setResult(null)
    try {
      const fd = new FormData(e.currentTarget)
      const res = await fetch('/api/admin/import', { method: 'POST', body: fd, credentials: 'include' })
      const json = await res.json()
      if (!res.ok) { setErrorMsg(json.error || 'Import failed.'); return }
      setResult(json.report)
      loadAlertCounts()
    } catch {
      setErrorMsg('Network error during import.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Data alerts banner */}
      <div
        style={{
          ...box,
          borderLeft: `4px solid ${errorAlerts > 0 ? '#B91C1C' : openAlerts ? '#C2A14E' : '#3FA68A'}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <strong style={{ fontSize: 15 }}>Data integrity</strong>
            <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
              {openAlerts === null
                ? 'Could not load alerts.'
                : openAlerts === 0
                ? 'No open alerts. Data looks clean.'
                : `${openAlerts} open alert${openAlerts === 1 ? '' : 's'}${errorAlerts > 0 ? ` (${errorAlerts} error${errorAlerts === 1 ? '' : 's'} need attention)` : ''}.`}
            </div>
          </div>
          <a
            href="/admin/collections/data-alerts?where[or][0][and][0][status][equals]=open"
            style={{
              fontSize: 13, fontWeight: 600, textDecoration: 'none',
              padding: '8px 14px', borderRadius: 999,
              background: 'var(--theme-elevation-100, #f1f5f9)', color: 'inherit',
            }}
          >
            View alerts →
          </a>
        </div>
      </div>

      {/* Bulk CSV import */}
      <div style={box}>
        <strong style={{ fontSize: 15 }}>Bulk import (CSV)</strong>
        <div style={{ fontSize: 13, opacity: 0.8, margin: '4px 0 14px' }}>
          Upload clinics, providers, and/or reviews CSVs (schema: <code>data/scraper-brief.md</code>). Existing rows are updated by id, not duplicated. Problems appear as data alerts above.
        </div>
        <form onSubmit={handleImport}>
          <div style={{ display: 'grid', gap: 10, maxWidth: 420 }}>
            <label style={{ fontSize: 13 }}>Clinics CSV
              <input name="clinics" type="file" accept=".csv" style={{ display: 'block', marginTop: 4 }} />
            </label>
            <label style={{ fontSize: 13 }}>Providers CSV
              <input name="providers" type="file" accept=".csv" style={{ display: 'block', marginTop: 4 }} />
            </label>
            <label style={{ fontSize: 13 }}>Reviews CSV
              <input name="reviews" type="file" accept=".csv" style={{ display: 'block', marginTop: 4 }} />
            </label>
          </div>
          <button
            type="submit"
            disabled={busy}
            style={{
              marginTop: 16, padding: '9px 18px', borderRadius: 999, border: 'none', cursor: busy ? 'default' : 'pointer',
              background: '#0B1B34', color: '#fff', fontSize: 13, fontWeight: 600, opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? 'Importing…' : 'Run import'}
          </button>
        </form>

        {errorMsg && <p style={{ color: '#B91C1C', fontSize: 13, marginTop: 12 }}>{errorMsg}</p>}

        {result && (
          <div style={{ marginTop: 16, fontSize: 13 }}>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <span>Clinics: <strong>{result.clinics.created}</strong> new, {result.clinics.updated} updated, {result.clinics.skipped} skipped</span>
              <span>Providers: <strong>{result.providers.created}</strong> new, {result.providers.updated} updated, {result.providers.skipped} skipped</span>
              <span>Reviews: <strong>{result.reviews.created}</strong> new, {result.reviews.updated} updated, {result.reviews.skipped} skipped</span>
            </div>
            {result.alerts.length > 0 && (
              <ul style={{ marginTop: 12, paddingLeft: 18 }}>
                {result.alerts.map((a, i) => (
                  <li key={i} style={{ marginBottom: 4, color: a.severity === 'error' ? '#B91C1C' : a.severity === 'warning' ? '#92710f' : 'inherit' }}>
                    [{a.severity}] {a.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
