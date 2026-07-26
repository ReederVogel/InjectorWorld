'use client'

import { useRef, useState } from 'react'

type GuideRow = {
  title: string
  url: string
  focusKeyword: string | null
  internalLinks: number
  externalLinks: number
  incomingLinks: number
  pendingOpportunities: number
  status: string
  reviewStatus: string
}
type NewsRow = GuideRow & { category: string }
type FaqRow = { question: string; scope: string; reviewStatus: string }

type PagesData = {
  generatedAt: string
  guides: GuideRow[]
  news: NewsRow[]
  faqs: FaqRow[]
  summary?: { orphanGuides: number; orphanNews: number }
}

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

// Small batch per request, so Stop takes effect within seconds. The loop can
// only break between requests, so this number IS the worst-case stop latency.
const SCAN_BATCH = 2

/**
 * Admin-facing trigger for the internal-linking discovery agent (via
 * OpenRouter). Calls /api/admin/internal-links/scan in a client-side loop,
 * two pages per call, until nothing is left unscanned or the admin stops it.
 * Shows live progress plus real token usage and approximate spend, accumulated
 * from OpenRouter's own reported usage. Results land as pending rows in the
 * Internal Link Suggestions collection for review/approval.
 */
function DiscoveryScanControl() {
  const [running, setRunning] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [scanned, setScanned] = useState(0)
  const [created, setCreated] = useState(0)
  const [failed, setFailed] = useState(0)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const [tokens, setTokens] = useState(0)
  const [cost, setCost] = useState(0)
  const [error, setError] = useState('')
  const stopRef = useRef(false)

  async function runLoop() {
    setRunning(true)
    setStopping(false)
    setError('')
    setScanned(0)
    setCreated(0)
    setFailed(0)
    setTokens(0)
    setCost(0)
    stopRef.current = false

    let sScanned = 0
    let sCreated = 0
    let sFailed = 0
    let sTokens = 0
    let sCost = 0

    try {
      while (!stopRef.current) {
        const res = await fetch('/api/admin/internal-links/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ limit: SCAN_BATCH }),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(body.error || `Scan failed (${res.status}).`)
          break
        }

        sScanned += body.scanned ?? 0
        sCreated += body.created ?? 0
        sFailed += body.failed ?? 0
        sTokens += (body.promptTokens ?? 0) + (body.completionTokens ?? 0)
        sCost += body.costUsd ?? 0

        setScanned(sScanned)
        setCreated(sCreated)
        setFailed(sFailed)
        setTokens(sTokens)
        setCost(sCost)
        setRemaining(body.remaining ?? 0)
        setTotal(body.total ?? null)

        // No forward progress (everything left is failing) or nothing left: stop.
        if (((body.scanned ?? 0) === 0 && (body.failed ?? 0) === 0) || (body.remaining ?? 0) <= 0) break
      }
    } catch {
      setError('Network error during scan.')
    } finally {
      setRunning(false)
      setStopping(false)
    }
  }

  function stop() {
    stopRef.current = true
    setStopping(true)
  }

  const done = total != null && remaining != null ? total - remaining : null

  return (
    <div style={scanBox}>
      <button type="button" style={primaryBtn} onClick={runLoop} disabled={running}>
        {running ? 'Scanning…' : 'Scan for new internal link opportunities'}
      </button>
      {running && (
        <button type="button" style={btnStyle} onClick={stop} disabled={stopping}>
          {stopping ? 'Stopping…' : 'Stop'}
        </button>
      )}

      {done != null && total != null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 220 }}>
          <div
            style={{
              flex: 1,
              height: 6,
              borderRadius: 999,
              background: 'var(--theme-elevation-150, #e2e8f0)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${total > 0 ? Math.round((done / total) * 100) : 0}%`,
                height: '100%',
                background: '#3FA68A',
                transition: 'width 200ms',
              }}
            />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
            {done} / {total} pages
          </span>
        </div>
      )}

      <span style={{ fontSize: 12, opacity: 0.75 }}>
        {scanned > 0 && `${created} suggestion${created === 1 ? '' : 's'} found`}
        {failed > 0 && ` · ${failed} failed (will retry)`}
        {tokens > 0 && ` · ${tokens.toLocaleString()} tokens · ~$${cost.toFixed(4)}`}
        {remaining === 0 && scanned > 0 && ' · all pages scanned'}
      </span>
      {error && <span style={{ fontSize: 12, color: '#B91C1C', fontWeight: 600 }}>{error}</span>}
      <span style={{ fontSize: 11, opacity: 0.55, width: '100%' }}>
        Finds new guide-to-guide, guide-to-news, news-to-guide, and brand/service link opportunities beyond the
        editorial-seeded ones. Pages with the fewest incoming links (orphans) are scanned first. Results go to Internal
        Link Suggestions as pending -- nothing changes on the live site until you approve each one there. Cost shown is
        an estimate from reported token usage.
      </span>
    </div>
  )
}

function KwCell({ value }: { value: string | null }) {
  if (!value) return <span style={{ opacity: 0.4, fontStyle: 'italic' }}>not set</span>
  return <>{value}</>
}

const SUGGESTIONS_URL = '/admin/collections/internal-link-suggestions?where[status][equals]=pending'

function GuideNewsTable({
  rows,
  showCategory,
  orphansOnly,
}: {
  rows: (GuideRow | NewsRow)[]
  showCategory?: boolean
  orphansOnly?: boolean
}) {
  const visible = orphansOnly ? rows.filter((r) => r.incomingLinks === 0) : rows

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={th}>Title</th>
            <th style={th}>URL</th>
            <th style={th}>Primary keyword</th>
            {showCategory && <th style={th}>Category</th>}
            <th style={th} title="Pages that link TO this page. 0 = orphan, hard to rank.">
              Incoming
            </th>
            <th style={th}>Internal links</th>
            <th style={th}>External links</th>
            <th style={th} title="Suggested links awaiting your review for this page.">
              Opportunities
            </th>
            <th style={th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 && (
            <tr>
              <td style={{ ...td, opacity: 0.6 }} colSpan={showCategory ? 9 : 8}>
                No pages match.
              </td>
            </tr>
          )}
          {visible.map((r) => {
            const isOrphan = r.incomingLinks === 0
            return (
              <tr key={r.url}>
                <td style={{ ...td, fontWeight: 600, maxWidth: 260 }}>{r.title}</td>
                <td style={td}>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--theme-text, inherit)' }}
                  >
                    {r.url.replace('https://www.injector.world', '')}
                  </a>
                </td>
                <td style={td}>
                  <KwCell value={r.focusKeyword} />
                </td>
                {showCategory && <td style={td}>{(r as NewsRow).category}</td>}
                <td style={td}>
                  {isOrphan ? (
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 700,
                        background: '#FDECEC',
                        color: '#B91C1C',
                      }}
                      title="Orphan page: no other page links to it."
                    >
                      orphan
                    </span>
                  ) : (
                    r.incomingLinks
                  )}
                </td>
                <td style={td}>{r.internalLinks}</td>
                <td style={td}>{r.externalLinks}</td>
                <td style={td}>
                  {r.pendingOpportunities > 0 ? (
                    <a href={SUGGESTIONS_URL} style={{ fontWeight: 700, color: '#3FA68A' }}>
                      {r.pendingOpportunities} to review
                    </a>
                  ) : (
                    <span style={{ opacity: 0.35 }}>—</span>
                  )}
                </td>
                <td style={td}>
                  {r.status} / {r.reviewStatus}
                </td>
              </tr>
            )
          })}
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
  const [orphansOnly, setOrphansOnly] = useState(false)

  async function load(force = false) {
    setOpen(true)
    if (data && !force) return
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
        <button type="button" style={btnStyle} onClick={() => load()}>
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
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button type="button" style={btnStyle} onClick={() => load(true)} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button type="button" style={btnStyle} onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
      </div>

      {data?.summary && tab !== 'faqs' && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>
            Orphan pages (nothing links to them):{' '}
            <span style={{ color: data.summary.orphanGuides + data.summary.orphanNews > 0 ? '#B91C1C' : '#3FA68A' }}>
              {data.summary.orphanGuides} guides · {data.summary.orphanNews} news
            </span>
          </span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <input type="checkbox" checked={orphansOnly} onChange={(e) => setOrphansOnly(e.target.checked)} />
            Show orphans only
          </label>
        </div>
      )}

      {loading && <div>Loading page details…</div>}
      {error && <div style={{ color: '#B91C1C' }}>{error}</div>}
      {data && tab === 'guides' && <GuideNewsTable rows={data.guides} orphansOnly={orphansOnly} />}
      {data && tab === 'news' && <GuideNewsTable rows={data.news} showCategory orphansOnly={orphansOnly} />}
      {data && tab === 'faqs' && <FaqTable rows={data.faqs} />}
    </div>
  )
}
