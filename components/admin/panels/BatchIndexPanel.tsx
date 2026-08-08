'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

/**
 * The rollout control room.
 *
 * Replaces a per-page review queue that showed ten rows at a time out of 51,099
 * and could only act on one at a time. Here the operator picks a slice of the url
 * registry, sees exactly how many urls match, previews a sample, and releases N of
 * them to Google in one action.
 *
 * Every write is preceded by a dry run: "Check" is the only button that runs
 * without confirmation, and the real action reports its batch label so it can be
 * rolled back.
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

type Stats = {
  byType: TypeRow[]
  totals: Record<string, number>
  batches: Batch[]
  thresholds: Record<string, number>
}

type DryRun = {
  matched: number
  wouldChange: number
  sample: { path: string; pageType: string; dataCount: number }[]
}

const TYPE_LABELS: Record<string, string> = {
  'service-city': 'Service × city',
  'service-state': 'Service × state',
  'service-pillar': 'Service pillar',
  'brand-city-directory': 'Brand × city',
  'brand-state': 'Brand × state',
  'brand-pillar': 'Brand pillar',
  'city-hub': 'City hub',
  'state-hub': 'State hub',
  clinic: 'Clinic profiles',
  guide: 'Guides',
  news: 'News',
  question: 'Questions',
  static: 'Static pages',
  provider: 'Provider profiles',
}

const card: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150, #e2e8f0)',
  borderRadius: 8,
  background: 'var(--theme-elevation-0, #fff)',
  padding: 16,
  marginBottom: 16,
}

const th: React.CSSProperties = {
  textAlign: 'left', padding: '6px 10px', opacity: 0.6, fontWeight: 600,
  fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
}
const td: React.CSSProperties = {
  padding: '7px 10px', fontSize: 13,
  borderTop: '1px solid var(--theme-elevation-100, #eef1f5)', whiteSpace: 'nowrap',
}

function btn(disabled: boolean, bg: string): React.CSSProperties {
  return {
    padding: '8px 16px', borderRadius: 8, border: 'none',
    cursor: disabled ? 'default' : 'pointer',
    background: bg, color: '#fff', fontSize: 13, fontWeight: 600,
    opacity: disabled ? 0.5 : 1,
  }
}

const input: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 8, fontSize: 13,
  border: '1px solid var(--theme-elevation-150, #e2e8f0)',
  background: 'var(--theme-input-bg, #fff)', color: 'inherit',
}

export function BatchIndexPanel() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [dry, setDry] = useState<DryRun | null>(null)

  // Filter
  const [pageType, setPageType] = useState('')
  const [stateSlug, setStateSlug] = useState('')
  const [count, setCount] = useState(100)
  const [sort, setSort] = useState('data-desc')
  const [onlyReady, setOnlyReady] = useState(true)
  const [label, setLabel] = useState('')

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

  const filter = useMemo(() => ({
    ...(pageType ? { pageTypes: [pageType] } : {}),
    ...(stateSlug.trim() ? { stateSlug: stateSlug.trim() } : {}),
    onlyReady,
  }), [pageType, stateSlug, onlyReady])

  async function callBatch(action: string, dryRun: boolean) {
    setBusy(`${action}:${dryRun ? 'dry' : 'go'}`)
    setMsg('')
    try {
      const res = await fetch('/api/admin/page-index/batch', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action, filter, count, sort, dryRun,
          ...(label.trim() ? { label: label.trim() } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMsg(data?.error ? `${data.error}${data.ref ? ` (ref ${data.ref})` : ''}` : 'Request failed.')
        return
      }
      if (dryRun) {
        setDry({ matched: data.matched, wouldChange: data.wouldChange, sample: data.sample ?? [] })
        setMsg(
          `${data.matched.toLocaleString()} url(s) match. This would ${action} ${data.wouldChange.toLocaleString()}.` +
          (data.capped ? ` Capped at ${data.capped.toLocaleString()} per action.` : ''),
        )
      } else {
        setDry(null)
        setMsg(
          `Done: ${action} applied to ${data.changed.toLocaleString()} url(s)` +
          (data.batchLabel ? ` as "${data.batchLabel}"` : '') +
          `. ${data.remaining.toLocaleString()} still match. ${data.note ?? ''}`,
        )
        await load()
      }
    } catch { setMsg('Network error.') }
    finally { setBusy('') }
  }

  async function rollback(batchLabel: string) {
    setBusy(`rollback:${batchLabel}`)
    setMsg('')
    try {
      const res = await fetch('/api/admin/page-index/batch', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rollback', batchLabel, dryRun: false }),
      })
      const data = await res.json()
      setMsg(res.ok
        ? `Rolled back "${batchLabel}": ${data.changed.toLocaleString()} url(s) back to Queued.`
        : data?.error ?? 'Rollback failed.')
      if (res.ok) await load()
    } catch { setMsg('Network error.') }
    finally { setBusy('') }
  }

  async function runScan() {
    setScanning(true); setMsg('')
    try {
      const res = await fetch('/api/admin/scan-pages', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      setMsg(res.ok
        ? `Scan done. ${data.created ?? 0} new url(s), ${data.updated ?? 0} updated, ${data.lostData ?? 0} lost data.`
        : data?.error ?? 'Scan failed.')
      if (res.ok) await load()
    } catch { setMsg('Network error.') }
    finally { setScanning(false) }
  }

  const t = stats?.totals ?? {}
  const readyForFilter = useMemo(() => {
    if (!stats) return 0
    const rows = pageType ? stats.byType.filter((r) => r.pageType === pageType) : stats.byType
    return rows.reduce((s, r) => s + (onlyReady ? r.ready : r.ready + r.belowThreshold), 0)
  }, [stats, pageType, onlyReady])

  return (
    <>
      {/* ── Where the rollout stands ───────────────────────────────────────── */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <strong style={{ fontSize: 15 }}>Rollout status</strong>
            <p style={{ margin: '4px 0 0', fontSize: 12.5, opacity: 0.7, maxWidth: 620 }}>
              Nothing indexes itself. Every url starts Queued (crawlable, noindex) and only
              enters the sitemap when it is batched in below. Queued urls still emit
              <code style={{ margin: '0 4px' }}>noindex,follow</code>
              so crawlers keep discovering internal links while the rollout is in progress.
            </p>
          </div>
          <button type="button" onClick={runScan} disabled={scanning} style={btn(scanning, '#0B1B34')}>
            {scanning ? 'Scanning…' : 'Run page scan'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', margin: '16px 0 0' }}>
          <Stat label="Total urls" value={t.total} href={URLS} />
          <Stat label="Indexed" value={t.indexed} tone="#3FA68A" href={`${URLS}?where[indexed][equals]=true`} />
          <Stat label="Queued" value={t.queued} href={`${URLS}?where[indexMode][equals]=queued`} />
          <Stat label="Ready to batch" value={t.ready} tone="#C2A14E" />
          <Stat label="Below threshold" value={t.belowThreshold} />
          <Stat label="Excluded" value={t.excluded} href={`${URLS}?where[indexMode][equals]=excluded`} />
          <Stat label="Nothing to show" value={t.notPublishable} href={`${URLS}?where[publishable][equals]=false`} />
        </div>
      </div>

      {/* ── The batch tool ─────────────────────────────────────────────────── */}
      <div style={card}>
        <strong style={{ fontSize: 15 }}>Batch index</strong>
        <p style={{ margin: '4px 0 14px', fontSize: 12.5, opacity: 0.7 }}>
          Pick a slice, check it, then release. Check always runs first and writes nothing.
        </p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="Page type">
            <select value={pageType} onChange={(e) => { setPageType(e.target.value); setDry(null) }} style={input}>
              <option value="">All types</option>
              {(stats?.byType ?? []).map((r) => (
                <option key={r.pageType} value={r.pageType}>
                  {TYPE_LABELS[r.pageType] ?? r.pageType} ({r.ready.toLocaleString()} ready)
                </option>
              ))}
            </select>
          </Field>

          <Field label="State slug (optional)">
            <input
              value={stateSlug}
              onChange={(e) => { setStateSlug(e.target.value); setDry(null) }}
              placeholder="texas"
              style={{ ...input, width: 130 }}
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
            <input
              value={label} onChange={(e) => setLabel(e.target.value)}
              placeholder="auto-generated" style={{ ...input, width: 160 }}
            />
          </Field>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, margin: '12px 0 0', cursor: 'pointer' }}>
          <input type="checkbox" checked={onlyReady} onChange={(e) => { setOnlyReady(e.target.checked); setDry(null) }} />
          <span>
            Only urls that clear their page type&apos;s threshold
            <span style={{ opacity: 0.6 }}> (uncheck to include deliberately thin pages)</span>
          </span>
        </label>

        <p style={{ margin: '10px 0 0', fontSize: 12.5, opacity: 0.75 }}>
          This filter currently covers <strong>{readyForFilter.toLocaleString()}</strong> candidate url(s).
        </p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
          <button type="button" onClick={() => callBatch('index', true)} disabled={!!busy} style={btn(!!busy, '#475569')}>
            {busy === 'index:dry' ? 'Checking…' : 'Check'}
          </button>
          <button
            type="button"
            onClick={() => callBatch('index', false)}
            disabled={!!busy || !dry || dry.wouldChange === 0}
            style={btn(!!busy || !dry || dry.wouldChange === 0, '#3FA68A')}
            title={dry ? '' : 'Run Check first'}
          >
            {busy === 'index:go'
              ? 'Indexing…'
              : dry ? `Index ${dry.wouldChange.toLocaleString()} url(s)` : 'Index (check first)'}
          </button>
          <button type="button" onClick={() => callBatch('exclude', true)} disabled={!!busy} style={btn(!!busy, '#475569')}>
            Check exclude
          </button>
          <button
            type="button"
            onClick={() => callBatch('exclude', false)}
            disabled={!!busy || !dry}
            style={{ ...btn(!!busy || !dry, 'transparent'), color: '#B91C1C', border: '1px solid #fecaca' }}
          >
            Exclude
          </button>
        </div>

        {msg && (
          <p style={{
            margin: '14px 0 0', fontSize: 12.5, padding: '9px 11px', borderRadius: 8,
            background: 'var(--theme-elevation-50, #f7f8fa)',
          }}>{msg}</p>
        )}

        {dry && dry.sample.length > 0 && (
          <div style={{ marginTop: 12, overflowX: 'auto' }}>
            <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
              Sample of what would be picked
            </div>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 480 }}>
              <thead><tr><th style={th}>Url</th><th style={th}>Type</th><th style={th}>Clinics</th></tr></thead>
              <tbody>
                {dry.sample.map((s) => (
                  <tr key={s.path}>
                    <td style={{ ...td, fontFamily: 'monospace', whiteSpace: 'normal', wordBreak: 'break-all' }}>{s.path}</td>
                    <td style={td}>{TYPE_LABELS[s.pageType] ?? s.pageType}</td>
                    <td style={td}>{s.dataCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Per-type breakdown ─────────────────────────────────────────────── */}
      <div style={card}>
        <strong style={{ fontSize: 15 }}>By page type</strong>
        <div style={{ marginTop: 10, overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 640 }}>
            <thead>
              <tr>
                <th style={th}>Type</th><th style={th}>Threshold</th><th style={th}>Total</th>
                <th style={th}>Indexed</th><th style={th}>Ready</th>
                <th style={th}>Below bar</th><th style={th}>Nothing to show</th><th style={th}>Excluded</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td style={td} colSpan={8}>Loading…</td></tr>}
              {!loading && (stats?.byType ?? []).length === 0 && (
                <tr><td style={td} colSpan={8}>No urls registered yet. Run the page scan.</td></tr>
              )}
              {(stats?.byType ?? []).map((r) => (
                <tr key={r.pageType}>
                  <td style={td}>{TYPE_LABELS[r.pageType] ?? r.pageType}</td>
                  <td style={{ ...td, opacity: 0.6 }}>{stats?.thresholds?.[r.pageType] ?? '—'}</td>
                  <td style={td}>{r.total.toLocaleString()}</td>
                  <td style={{ ...td, color: r.indexed > 0 ? '#3FA68A' : undefined, fontWeight: r.indexed > 0 ? 600 : 400 }}>
                    {r.indexed.toLocaleString()}
                  </td>
                  <td style={td}>{r.ready.toLocaleString()}</td>
                  <td style={{ ...td, opacity: 0.6 }}>{r.belowThreshold.toLocaleString()}</td>
                  <td style={{ ...td, opacity: 0.6 }}>{r.notPublishable.toLocaleString()}</td>
                  <td style={{ ...td, opacity: 0.6 }}>{r.excluded.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Batch history + rollback ───────────────────────────────────────── */}
      {(stats?.batches ?? []).length > 0 && (
        <div style={card}>
          <strong style={{ fontSize: 15 }}>Recent batches</strong>
          <p style={{ margin: '4px 0 10px', fontSize: 12.5, opacity: 0.7 }}>
            Rolling a batch back returns every url in it to Queued, removing them from the sitemap.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 460 }}>
              <thead><tr><th style={th}>Batch</th><th style={th}>Urls</th><th style={th}>When</th><th style={th} /></tr></thead>
              <tbody>
                {(stats?.batches ?? []).map((b) => (
                  <tr key={b.batchLabel}>
                    <td style={{ ...td, fontFamily: 'monospace' }}>{b.batchLabel}</td>
                    <td style={td}>{b.urls.toLocaleString()}</td>
                    <td style={{ ...td, opacity: 0.6 }}>
                      {b.firstAt ? new Date(b.firstAt).toLocaleDateString() : '—'}
                    </td>
                    <td style={td}>
                      <button
                        type="button"
                        onClick={() => rollback(b.batchLabel)}
                        disabled={!!busy}
                        style={{
                          ...btn(!!busy, 'transparent'),
                          color: '#B91C1C', border: '1px solid #fecaca', padding: '5px 11px', fontSize: 12,
                        }}
                      >
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
      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: tone }}>
        {value == null ? '—' : value.toLocaleString()}
      </div>
      <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>{label}</div>
    </>
  )
  return href
    ? <a href={href} style={{ textDecoration: 'none', color: 'inherit' }}>{body}</a>
    : <div>{body}</div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
      {children}
    </label>
  )
}
