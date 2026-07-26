'use client'

import { useRef, useState } from 'react'

type GuideRow = {
  title: string
  url: string
  focusKeyword: string | null
  internalLinks: number
  externalLinks: number
  status: string
  reviewStatus: string
}
type NewsRow = GuideRow & { category: string }
type FaqRow = { question: string; scope: string; reviewStatus: string }

type PagesData = { generatedAt: string; guides: GuideRow[]; news: NewsRow[]; faqs: FaqRow[] }

const box: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150, #e2e8f0)',
  borderRadius: 12,
  background: 'var(--theme-elevation-0, #fff)',
  padding: 16,
  marginTop: 16,
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '6px 10px',
  opacity: 0.6,
  fontWeight: 600,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  whiteSpace: 'nowrap',
}

const td: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: 13,
  borderTop: '1px solid var(--theme-elevation-100, #eef1f5)',
}

const btnStyle: React.CSSProperties = {
  padding: '7px 14px',
  borderRadius: 999,
  border: '1px solid var(--theme-elevation-150, #e2e8f0)',
  background: 'var(--theme-elevation-50, #f7f8fa)',
  color: 'inherit',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}

const primaryBtn: React.CSSProperties = {
  ...btnStyle,
  background: '#0B1B34',
  border: '1px solid #0B1B34',
  color: '#fff',
}

const scanBox: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150, #e2e8f0)',
  borderRadius: 10,
  background: 'var(--theme-elevation-50, #f7f8fa)',
  padding: 12,
  marginBottom: 16,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
}

/**
 * Admin-facing trigger for the internal-linking discovery agent (Kimi K3 via
 * OpenRouter). Calls /api/admin/internal-links/scan in a client-side loop,
 * a bounded batch (8 pages) per call, until nothing is left unscanned or the
 * admin stops it -- keeps each server request short and shows live progress
 * instead of one long blocking call. Results land as pending rows in the
 * Internal Link Suggestions collection for review/approval.
 */
function DiscoveryScanControl() {
  const [running, setRunning] = useState(false)
  const [scanned, setScanned] = useState(0)
  const [created, setCreated] = useState(0)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [error, setError] = useState('')
  const stopRef = useRef(false)

  async function runLoop() {
    setRunning(true)
    setError('')
    stopRef.current = false
    let sessionScanned = 0
    let sessionCreated = 0

    try {
      while (!stopRef.current) {
        const res = await fetch('/api/admin/internal-links/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ limit: 8 }),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(body.error || `Scan failed (${res.status}).`)
          break
        }
        sessionScanned += body.scanned ?? 0
        sessionCreated += body.created ?? 0
        setScanned(sessionScanned)
        setCreated(sessionCreated)
        setRemaining(body.remaining ?? 0)
        if (!body.scanned || body.remaining <= 0) break
      }
    } catch {
      setError('Network error during scan.')
    } finally {
      setRunning(false)
    }
  }

  function stop() {
    stopRef.current = true
  }

  return (
    <div style={scanBox}>
      <button type="button" style={primaryBtn} onClick={runLoop} disabled={running}>
        {running ? 'Scanning…' : 'Scan for new internal link opportunities'}
      </button>
      {running && (
        <button type="button" style={btnStyle} onClick={stop}>
          Stop
        </button>
      )}
      <span style={{ fontSize: 12, opacity: 0.75 }}>
        {scanned > 0 && `Scanned ${scanned} pages, found ${created} suggestion${created === 1 ? '' : 's'}.`}
        {remaining != null && remaining > 0 && ` ${remaining} pages left to scan.`}
        {remaining === 0 && scanned > 0 && ' All pages scanned.'}
      </span>
      {error && <span style={{ fontSize: 12, color: '#B91C1C', fontWeight: 600 }}>{error}</span>}
      <span style={{ fontSize: 11, opacity: 0.55, width: '100%' }}>
        Uses OpenRouter (Kimi K3) to find new links beyond the editorial-seeded ones. Results go to Internal Link
        Suggestions as pending -- nothing changes on the live site until you approve each one there.
      </span>
    </div>
  )
}

function KwCell({ value }: { value: string | null }) {
  if (!value) return <span style={{ opacity: 0.4, fontStyle: 'italic' }}>not set</span>
  return <>{value}</>
}

function GuideNewsTable({ rows, showCategory }: { rows: (GuideRow | NewsRow)[]; showCategory?: boolean }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={th}>Title</th>
            <th style={th}>URL</th>
            <th style={th}>Primary keyword</th>
            {showCategory && <th style={th}>Category</th>}
            <th style={th}>Internal links</th>
            <th style={th}>External links</th>
            <th style={th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.url}>
              <td style={{ ...td, fontWeight: 600, maxWidth: 260 }}>{r.title}</td>
              <td style={td}>
                <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--theme-text, inherit)' }}>
                  {r.url.replace('https://www.injector.world', '')}
                </a>
              </td>
              <td style={td}><KwCell value={r.focusKeyword} /></td>
              {showCategory && <td style={td}>{(r as NewsRow).category}</td>}
              <td style={td}>{r.internalLinks}</td>
              <td style={td}>{r.externalLinks}</td>
              <td style={td}>{r.status} / {r.reviewStatus}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FaqTable({ rows }: { rows: FaqRow[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={th}>Question</th>
            <th style={th}>Scope</th>
            <th style={th}>Review status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td style={{ ...td, fontWeight: 600, maxWidth: 400 }}>{r.question}</td>
              <td style={td}>{r.scope}</td>
              <td style={td}>{r.reviewStatus}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ContentReportSeoTables() {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<PagesData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'guides' | 'news' | 'faqs'>('guides')

  async function load() {
    setOpen(true)
    if (data) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/content-report/pages', { credentials: 'include' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body.error || `Failed to load (${res.status}).`)
        return
      }
      setData(body)
    } catch {
      setError('Network error while loading page details.')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <div style={{ marginTop: 12 }}>
        <button type="button" style={btnStyle} onClick={load}>
          Show per-page SEO details (Guides / News / FAQs)
        </button>
      </div>
    )
  }

  return (
    <div style={box}>
      <DiscoveryScanControl />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['guides', 'news', 'faqs'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                ...btnStyle,
                background: tab === t ? '#0B1B34' : btnStyle.background,
                color: tab === t ? '#fff' : 'inherit',
                border: tab === t ? '1px solid #0B1B34' : btnStyle.border,
                textTransform: 'capitalize',
              }}
            >
              {t} {data ? `(${data[t].length})` : ''}
            </button>
          ))}
        </div>
        <button type="button" style={btnStyle} onClick={() => setOpen(false)}>Close</button>
      </div>

      {loading && <div>Loading page details…</div>}
      {error && <div style={{ color: '#B91C1C' }}>{error}</div>}
      {data && tab === 'guides' && <GuideNewsTable rows={data.guides} />}
      {data && tab === 'news' && <GuideNewsTable rows={data.news} showCategory />}
      {data && tab === 'faqs' && <FaqTable rows={data.faqs} />}
    </div>
  )
}
