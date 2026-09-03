'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

/**
 * Auto-generated pages: the ~104,000 listing urls the system derives from clinic
 * data (a treatment in a city, a brand in a state, a city page). Nobody wrote
 * these and they have no names, so they are controlled by RULE, not row by row.
 *
 * This replaced a table that mixed them with clinics, guides and news. That
 * table's first page was rows like /brands/botox/california/union-city-ca, which
 * is unreadable and also not what an operator is looking for. Content moved to
 * /admin/content-indexing; this screen is only the machine-generated set.
 *
 * A single-url lookup is still here, because "why is this one page not in
 * Google" is a real question that rules cannot answer.
 */

const URLS = '/admin/collections/page-index'

type TypeRow = {
  pageType: string
  total: number
  indexed: number
  queued: number
  excluded: number
  ready: number
  belowThreshold: number
  notPublishable: number
  newUntriaged: number
}

type Batch = { batchLabel: string; urls: number; firstAt: string | null }
type StateRow = { slug: string; urls: number; waiting: number }

type ScanJob = {
  id: number | string
  status: string
  phase: string | null
  processedRows: number
  totalRows: number | null
  startedAt: string | null
}

type Stats = {
  byType: TypeRow[]
  totals: Record<string, number>
  batches: Batch[]
  states: StateRow[]
  thresholds: Record<string, number>
  labels: Record<string, string>
  computedTypes: string[]
}

type DryRun = {
  /**
   * Which action this preview was produced for. The Apply buttons check it, so
   * a preview run for one action can never be applied by another: previewing
   * "Submit" and then clicking "Never submit" would otherwise act on numbers the
   * operator never saw, and these are the highest-leverage writes in the admin.
   */
  action: string
  matched: number
  wouldChange: number
  sample: { path: string; pageType: string; dataCount: number }[]
}

type LookupRow = {
  id: number
  path: string
  pageType: string
  indexMode: string
  indexed: boolean
  publishable: boolean
  meetsThreshold: boolean
  dataCount: number
  batchLabel: string | null
  lastScannedAt: string | null
}

const card: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150, #e2e8f0)', borderRadius: 8,
  background: 'var(--theme-elevation-0, #fff)', padding: 16, marginBottom: 16,
}
const th: React.CSSProperties = {
  textAlign: 'left', padding: '8px 10px', opacity: 0.6, fontWeight: 600, fontSize: 10.5,
  textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
}
const td: React.CSSProperties = {
  padding: '9px 10px', fontSize: 13, borderTop: '1px solid var(--theme-elevation-100, #eef1f5)', whiteSpace: 'nowrap',
}
const input: React.CSSProperties = {
  padding: '7px 9px', borderRadius: 8, fontSize: 13,
  border: '1px solid var(--theme-elevation-150, #e2e8f0)',
  background: 'var(--theme-input-bg, #fff)', color: 'inherit',
}
function btn(disabled: boolean, bg: string, fg = '#fff'): React.CSSProperties {
  return {
    padding: '8px 15px', borderRadius: 8, border: 'none', background: bg, color: fg,
    fontSize: 13, fontWeight: 600, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
  }
}
const fmt = (n?: number | null) => (n == null ? '—' : n.toLocaleString())

export function BatchIndexPanel() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [scanJob, setScanJob] = useState<ScanJob | null>(null)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [dry, setDry] = useState<DryRun | null>(null)

  // The rule
  const [pageType, setPageType] = useState('')
  const [stateSlug, setStateSlug] = useState('')
  const [minClinics, setMinClinics] = useState(5)
  const [count, setCount] = useState(500)
  const [sort, setSort] = useState('data-desc')
  const [label, setLabel] = useState('')

  // Single-url lookup
  const [lookupQ, setLookupQ] = useState('')
  const [lookup, setLookup] = useState<LookupRow[] | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/page-index', { credentials: 'include' })
      const data = await res.json()
      if (res.ok) setStats(data)
      else setMsg(data?.error ?? 'Could not load stats.')
    } catch { setMsg('Network error loading stats.') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // The scan is a background job: it writes ~144,000 rows, which does not fit in
  // one HTTP call. POST returns 202 and we poll until it settles.
  const pollScan = useCallback(async function pollScan() {
    try {
      const res = await fetch('/api/admin/scan-pages', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) return

      if (data.active) {
        setScanning(true); setScanJob(data.active)
        setTimeout(pollScan, 2000)
        return
      }
      setScanning(false); setScanJob(null)
      const last = data.history?.[0]
      if (last?.status === 'done') {
        setMsg(
          `Scan finished. ${fmt(last.createdRows)} new url(s), ${fmt(last.updatedRows)} updated, ` +
          `${fmt(last.lostDataRows)} lost data.` +
          (last.unmappedClinics ? ` ${fmt(last.unmappedClinics)} clinic(s) had no matching location and were skipped.` : ''),
        )
        await load()
      } else if (last && (last.status === 'failed' || last.status === 'abandoned')) {
        setMsg(last.error || 'The scan did not finish.')
      }
    } catch { /* transient: the next poll retries */ }
  }, [load])

  useEffect(() => { pollScan() }, [pollScan])

  async function runScan() {
    setScanning(true); setMsg('')
    try {
      const res = await fetch('/api/admin/scan-pages', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) { setScanning(false); setMsg(data?.error ?? 'Could not start the scan.'); return }
      setMsg('Scan started. This takes a few minutes on a full registry.')
      pollScan()
    } catch { setScanning(false); setMsg('Network error.') }
  }

  // Only computed types belong on this screen. Clinics, guides, news and site
  // pages are documents someone uploaded and live on the Content screen.
  const computed = useMemo(() => {
    if (!stats) return []
    const allowed = new Set(stats.computedTypes ?? [])
    return stats.byType.filter((r) => allowed.has(r.pageType))
  }, [stats])

  const autoTotals = useMemo(() => {
    const acc = { total: 0, indexed: 0, queued: 0, ready: 0, belowThreshold: 0, excluded: 0 }
    for (const r of computed) {
      acc.total += r.total; acc.indexed += r.indexed; acc.queued += r.queued
      acc.ready += r.ready; acc.belowThreshold += r.belowThreshold; acc.excluded += r.excluded
    }
    return acc
  }, [computed])

  const labelOf = (t: string) => stats?.labels?.[t] ?? t

  const filter = useMemo(() => ({
    ...(pageType ? { pageTypes: [pageType] } : { pageTypes: stats?.computedTypes ?? [] }),
    ...(stateSlug ? { stateSlug } : {}),
    minClinics,
  }), [pageType, stateSlug, minClinics, stats])

  async function callBatch(action: string, dryRun: boolean) {
    setBusy(`${action}:${dryRun ? 'dry' : 'go'}`); setMsg('')
    try {
      const res = await fetch('/api/admin/page-index/batch', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, filter, count, sort, dryRun, ...(label.trim() ? { label: label.trim() } : {}) }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMsg(`${data?.error ?? 'Request failed.'}${data?.ref ? ` (ref ${data.ref})` : ''}`)
        return
      }
      if (dryRun) {
        setDry({ action, matched: data.matched, wouldChange: data.wouldChange, sample: data.sample ?? [] })
        setMsg(
          `${fmt(data.matched)} page(s) match this rule. This would ${action} ${fmt(data.wouldChange)}.` +
          (data.capped ? ` Capped at ${fmt(data.capped)} per action.` : ''),
        )
      } else {
        setDry(null)
        setMsg(
          `Done: ${action} applied to ${fmt(data.changed)} page(s)` +
          (data.batchLabel ? ` as "${data.batchLabel}"` : '') +
          `. ${fmt(data.remaining)} still match. ${data.note ?? ''}`,
        )
        await load()
      }
    } catch { setMsg('Network error.') }
    finally { setBusy('') }
  }

  async function rollback(batchLabel: string) {
    setBusy(`rollback:${batchLabel}`); setMsg('')
    try {
      const res = await fetch('/api/admin/page-index/batch', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rollback', batchLabel, dryRun: false }),
      })
      const data = await res.json()
      setMsg(res.ok
        ? `Rolled back "${batchLabel}": ${fmt(data.changed)} page(s) back to Not submitted.`
        : data?.error ?? 'Rollback failed.')
      if (res.ok) await load()
    } catch { setMsg('Network error.') }
    finally { setBusy('') }
  }

  async function runLookup() {
    const q = lookupQ.trim()
    if (!q) { setLookup(null); return }
    setBusy('lookup')
    try {
      const res = await fetch(`/api/admin/page-index?lookup=${encodeURIComponent(q)}`, { credentials: 'include' })
      const data = await res.json()
      setLookup(res.ok ? (data.lookup ?? []) : [])
    } catch { setLookup([]) }
    finally { setBusy('') }
  }

  return (
    <>
      {/* ── Status + scan ──────────────────────────────────────────────────── */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <strong style={{ fontSize: 15 }}>Auto-generated pages</strong>
            <p style={{ margin: '4px 0 0', fontSize: 12.5, opacity: 0.7, maxWidth: 640 }}>
              Listing pages the system builds from clinic data. Nothing here is submitted to Google
              until a rule below sends it. Everything else still emits
              <code style={{ margin: '0 4px' }}>noindex,follow</code>
              so crawlers keep finding internal links while the rollout runs.
            </p>
          </div>
          <button type="button" onClick={runScan} disabled={scanning} style={btn(scanning, '#0B1B34')}>
            {scanning ? 'Scanning…' : 'Run page scan'}
          </button>
        </div>

        {scanJob && (
          <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--theme-elevation-50, #F7F8FA)', borderRadius: 8, border: '1px solid var(--theme-elevation-150, #e2e8f0)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', fontSize: 12.5 }}>
              <strong>{scanJob.phase ?? 'Working'}</strong>
              {scanJob.totalRows ? (
                <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.7 }}>
                  {fmt(scanJob.processedRows)} / {fmt(scanJob.totalRows)}
                </span>
              ) : null}
            </div>
            <div style={{ height: 6, borderRadius: 999, background: 'var(--theme-elevation-150, #E2E8F0)', overflow: 'hidden', marginTop: 8 }}>
              <div style={{
                height: '100%', background: '#3FA68A',
                width: scanJob.totalRows ? `${Math.min(100, Math.round((scanJob.processedRows / scanJob.totalRows) * 100))}%` : '8%',
                transition: 'width .3s ease',
              }} />
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 11.5, opacity: 0.6 }}>
              Safe to leave this page. The scan keeps running and never changes an indexing decision.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', margin: '16px 0 0' }}>
          <Stat label="Auto pages" value={loading ? undefined : autoTotals.total} href={URLS} />
          <Stat label="Submitted to Google" value={loading ? undefined : autoTotals.indexed} tone="#3FA68A" />
          <Stat label="Not submitted" value={loading ? undefined : autoTotals.queued} />
          <Stat label="Ready to submit" value={loading ? undefined : autoTotals.ready} tone="#C2A14E" />
          <Stat label="Below the bar" value={loading ? undefined : autoTotals.belowThreshold} />
          <Stat label="Never submit" value={loading ? undefined : autoTotals.excluded} />
        </div>

        <p style={{ margin: '14px 0 0', fontSize: 12.5, opacity: 0.7 }}>
          Your clinics, guides and news are on the{' '}
          <a href="/admin/content-indexing" style={{ color: '#3FA68A', fontWeight: 600 }}>Content indexing</a> screen.
        </p>
      </div>

      {/* ── Rule builder ───────────────────────────────────────────────────── */}
      <div style={card}>
        <strong style={{ fontSize: 15 }}>Submit pages by rule</strong>
        <p style={{ margin: '4px 0 14px', fontSize: 12.5, opacity: 0.7 }}>
          Describe a slice, check what it covers, then send it. Check writes nothing.
        </p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="Page kind">
            <select value={pageType} onChange={(e) => { setPageType(e.target.value); setDry(null) }} style={input}>
              <option value="">All kinds</option>
              {computed.map((r) => (
                <option key={r.pageType} value={r.pageType}>
                  {labelOf(r.pageType)} ({fmt(r.queued)} waiting)
                </option>
              ))}
            </select>
          </Field>

          <Field label="Where">
            <select value={stateSlug} onChange={(e) => { setStateSlug(e.target.value); setDry(null) }} style={input}>
              <option value="">All states</option>
              {(stats?.states ?? []).map((s) => (
                <option key={s.slug} value={s.slug}>{s.slug} ({fmt(s.waiting)} waiting)</option>
              ))}
            </select>
          </Field>

          <Field label="Minimum clinics">
            <input
              type="number" min={1} max={200} value={minClinics}
              onChange={(e) => { setMinClinics(Math.max(1, Number(e.target.value) || 1)); setDry(null) }}
              style={{ ...input, width: 96 }}
            />
          </Field>

          <Field label="How many">
            <input
              type="number" min={1} max={10000} value={count}
              onChange={(e) => { setCount(Math.max(1, Number(e.target.value) || 1)); setDry(null) }}
              style={{ ...input, width: 100 }}
            />
          </Field>

          <Field label="Pick order">
            <select value={sort} onChange={(e) => { setSort(e.target.value); setDry(null) }} style={input}>
              <option value="data-desc">Most clinics first</option>
              <option value="oldest">Longest waiting first</option>
              <option value="data-asc">Fewest clinics first</option>
            </select>
          </Field>

          <Field label="Batch name (optional)">
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="auto-generated" style={{ ...input, width: 150 }} />
          </Field>
        </div>

        {/**
          * Each action carries its own Check, and each Apply is gated on a
          * preview run for THAT action.
          *
          * Both buttons used to share one preview produced by Submit's Check.
          * They do not select the same rows -- Submit matches
          * `index_mode = 'queued' AND publishable`, Never submit matches
          * `index_mode <> 'excluded'` -- so the count shown before excluding was
          * not the count that would be excluded. On the highest-leverage write
          * in the admin, that is worth two extra clicks.
          */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, alignItems: 'center' }}>
          <button type="button" onClick={() => callBatch('index', true)} disabled={!!busy} style={btn(!!busy, '#475569')}>
            {busy === 'index:dry' ? 'Checking…' : 'Check'}
          </button>
          <button
            type="button" onClick={() => callBatch('index', false)}
            disabled={!!busy || dry?.action !== 'index' || dry.wouldChange === 0}
            style={btn(!!busy || dry?.action !== 'index' || dry.wouldChange === 0, '#3FA68A')}
            title={dry?.action === 'index' ? '' : 'Run Check first'}
          >
            {busy === 'index:go'
              ? 'Submitting…'
              : dry?.action === 'index' ? `Submit ${fmt(dry.wouldChange)} page(s)` : 'Submit (check first)'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
          <button type="button" onClick={() => callBatch('exclude', true)} disabled={!!busy} style={btn(!!busy, '#475569')}>
            {busy === 'exclude:dry' ? 'Checking…' : 'Check never submit'}
          </button>
          <button
            type="button" onClick={() => callBatch('exclude', false)}
            disabled={!!busy || dry?.action !== 'exclude' || dry.wouldChange === 0}
            style={{
              ...btn(!!busy || dry?.action !== 'exclude' || dry.wouldChange === 0, 'transparent'),
              color: '#B91C1C', border: '1px solid #fecaca',
            }}
            title={dry?.action === 'exclude' ? '' : 'Run Check never submit first'}
          >
            {busy === 'exclude:go'
              ? 'Excluding…'
              : dry?.action === 'exclude' ? `Never submit ${fmt(dry.wouldChange)} page(s)` : 'Never submit (check first)'}
          </button>
        </div>

        {msg && (
          <p style={{ margin: '14px 0 0', fontSize: 12.5, padding: '9px 11px', borderRadius: 8, background: 'var(--theme-elevation-50, #f7f8fa)' }}>{msg}</p>
        )}

        {dry && dry.sample.length > 0 && (
          <div style={{ marginTop: 12, overflowX: 'auto' }}>
            <div style={{ ...th, padding: '0 0 4px' }}>Sample of what this rule picks</div>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 460 }}>
              <thead><tr><th style={th}>Url</th><th style={th}>Kind</th><th style={th}>Clinics</th></tr></thead>
              <tbody>
                {dry.sample.map((s) => (
                  <tr key={s.path}>
                    <td style={{ ...td, fontFamily: 'monospace', whiteSpace: 'normal', wordBreak: 'break-all' }}>{s.path}</td>
                    <td style={td}>{labelOf(s.pageType)}</td>
                    <td style={td}>{s.dataCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Per-kind breakdown ─────────────────────────────────────────────── */}
      <div style={card}>
        <strong style={{ fontSize: 15 }}>By page kind</strong>
        <div style={{ marginTop: 10, overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 640 }}>
            <thead>
              <tr>
                <th style={th}>Kind</th><th style={th}>Default bar</th><th style={th}>Total</th>
                <th style={th}>Submitted</th><th style={th}>Ready</th>
                <th style={th}>Below bar</th><th style={th}>Nothing to show</th><th style={th}>Never</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td style={td} colSpan={8}>Loading…</td></tr>}
              {!loading && computed.length === 0 && (
                <tr><td style={td} colSpan={8}>No auto-generated pages yet. Run the page scan.</td></tr>
              )}
              {computed.map((r) => (
                <tr key={r.pageType}>
                  <td style={td}>{labelOf(r.pageType)}</td>
                  <td style={{ ...td, opacity: 0.6 }}>{stats?.thresholds?.[r.pageType] ?? '—'}</td>
                  <td style={td}>{fmt(r.total)}</td>
                  <td style={{ ...td, color: r.indexed > 0 ? '#3FA68A' : undefined, fontWeight: r.indexed > 0 ? 600 : 400 }}>{fmt(r.indexed)}</td>
                  <td style={td}>{fmt(r.ready)}</td>
                  <td style={{ ...td, opacity: 0.6 }}>{fmt(r.belowThreshold)}</td>
                  <td style={{ ...td, opacity: 0.6 }}>{fmt(r.notPublishable)}</td>
                  <td style={{ ...td, opacity: 0.6 }}>{fmt(r.excluded)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Single-url lookup ──────────────────────────────────────────────── */}
      <div style={card}>
        <strong style={{ fontSize: 15 }}>Find one page</strong>
        <p style={{ margin: '4px 0 12px', fontSize: 12.5, opacity: 0.7 }}>
          For when you need to know why one specific url is or is not in Google.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            value={lookupQ}
            onChange={(e) => setLookupQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') runLookup() }}
            placeholder="/services/lip-filler/texas/houston-tx"
            style={{ ...input, flex: 1, minWidth: 260, fontFamily: 'monospace' }}
          />
          <button type="button" onClick={runLookup} disabled={!!busy} style={btn(!!busy, '#0B1B34')}>
            {busy === 'lookup' ? 'Searching…' : 'Find'}
          </button>
        </div>

        {lookup && (
          <div style={{ marginTop: 12, overflowX: 'auto' }}>
            {lookup.length === 0 ? (
              <p style={{ fontSize: 12.5, opacity: 0.7, margin: 0 }}>No url matches that.</p>
            ) : (
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 700 }}>
                <thead>
                  <tr><th style={th}>Url</th><th style={th}>Kind</th><th style={th}>In Google</th>
                    <th style={th}>Live on site</th><th style={th}>Clears bar</th><th style={th}>Clinics</th><th style={th} /></tr>
                </thead>
                <tbody>
                  {lookup.map((r) => (
                    <tr key={r.id}>
                      <td style={{ ...td, fontFamily: 'monospace', whiteSpace: 'normal', wordBreak: 'break-all' }}>{r.path}</td>
                      <td style={td}>{labelOf(r.pageType)}</td>
                      <td style={td}>
                        {r.indexed
                          ? <span style={{ color: '#3FA68A', fontWeight: 600 }}>Submitted</span>
                          : r.indexMode === 'excluded'
                            ? <span style={{ color: '#B91C1C', fontWeight: 600 }}>Never</span>
                            : <span style={{ opacity: 0.7 }}>Not submitted</span>}
                      </td>
                      <td style={{ ...td, color: r.publishable ? undefined : '#B91C1C' }}>{r.publishable ? 'Yes' : 'No'}</td>
                      <td style={{ ...td, opacity: r.meetsThreshold ? 1 : 0.6 }}>{r.meetsThreshold ? 'Yes' : 'No'}</td>
                      <td style={td}>{fmt(r.dataCount)}</td>
                      <td style={td}>
                        <a href={`${URLS}/${r.id}`} style={{ fontSize: 12, color: '#3FA68A', fontWeight: 600, textDecoration: 'none' }}>Open</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ── Batch history ──────────────────────────────────────────────────── */}
      {(stats?.batches ?? []).length > 0 && (
        <div style={card}>
          <strong style={{ fontSize: 15 }}>Recent batches</strong>
          <p style={{ margin: '4px 0 10px', fontSize: 12.5, opacity: 0.7 }}>
            Rolling a batch back returns every url in it to Not submitted, removing them from the sitemap.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 460 }}>
              <thead><tr><th style={th}>Batch</th><th style={th}>Urls</th><th style={th}>When</th><th style={th} /></tr></thead>
              <tbody>
                {(stats?.batches ?? []).map((b) => (
                  <tr key={b.batchLabel}>
                    <td style={{ ...td, fontFamily: 'monospace' }}>{b.batchLabel}</td>
                    <td style={td}>{fmt(b.urls)}</td>
                    <td style={{ ...td, opacity: 0.6 }}>{b.firstAt ? new Date(b.firstAt).toLocaleDateString() : '—'}</td>
                    <td style={td}>
                      <button type="button" onClick={() => rollback(b.batchLabel)} disabled={!!busy}
                        style={{ ...btn(!!busy, 'transparent'), color: '#B91C1C', border: '1px solid #fecaca', padding: '5px 11px', fontSize: 12 }}>
                        {busy === `rollback:${b.batchLabel}` ? 'Rolling back…' : 'Roll back'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

function Stat({ label, value, tone, href }: { label: string; value?: number; tone?: string; href?: string }) {
  const body = (
    <>
      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: tone }}>{fmt(value)}</div>
      <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>{label}</div>
    </>
  )
  return href ? <a href={href} style={{ textDecoration: 'none', color: 'inherit' }}>{body}</a> : <div>{body}</div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 10.5, fontWeight: 600, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
      {children}
    </label>
  )
}
