'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

/**
 * Content indexing: one row per real document, with the dates, import batch and
 * readiness signals an operator needs to decide what deserves to be in Google.
 *
 * This is the screen the URLs table could not be. The registry holds ~144,000
 * rows, and the 39,864 documents someone actually uploaded were buried under
 * 104,000 auto-generated listing pages with machine names. Those live on the
 * Indexing screen as rules; this screen is only content.
 *
 * Nothing here is denormalised: readiness is computed live in SQL on every
 * request, so linking a service to a clinic shows up immediately instead of
 * waiting for the next scan.
 */

const TABS = [
  { key: 'clinics', label: 'Clinics' },
  { key: 'guides', label: 'Guides' },
  { key: 'news', label: 'News' },
  { key: 'static', label: 'Site pages' },
] as const

type Tab = (typeof TABS)[number]['key']
/** Tabs backed by a real collection. 'static' is a different shape entirely. */
type DocTab = Exclude<Tab, 'static'>

type SitePage = {
  rowId: number | null
  path: string
  name: string
  indexMode: string | null
  indexed: boolean
  publishable: boolean
  indexedAt: string | null
  indexable: boolean
  note?: string
}

type Row = {
  rowId: number | null
  sourceId: number
  name: string
  city: string | null
  state: string | null
  subType: string | null
  reviewCount: number | null
  path: string | null
  slug: string
  status: string
  indexMode: string | null
  indexed: boolean
  publishable: boolean
  indexedAt: string | null
  batchLabel: string | null
  uploadedAt: string | null
  publishedAt: string | null
  updatedAt: string | null
  importBatch: string | null
  readiness: boolean[]
}

type Facets = {
  importBatches: { value: string; count: number }[]
  states: { value: string; count: number }[]
}

type Summary = {
  total: number; submitted: number; queued: number
  excluded: number; unregistered: number; ready: number
}

type Detail = {
  sourceId: number; name: string; path: string | null; status: string
  indexMode: string | null; indexed: boolean; publishable: boolean
  indexedAt: string | null; batchLabel: string | null
  uploadedAt: string | null; publishedAt: string | null; updatedAt: string | null
  importBatch: string | null; readiness: boolean[]
  metaTitle: string; metaDescription: string; metaSource: 'stored' | 'generated'
  schema: string; sitemapChild: string; robotsNow: string; adminUrl: string
}

const PROBLEMS: Record<DocTab, { value: string; label: string }[]> = {
  clinics: [
    { value: 'ready', label: 'Ready only' },
    { value: 'no-services', label: 'No services linked' },
    { value: 'no-photos', label: 'No photos' },
    { value: 'no-description', label: 'No description' },
    { value: 'type-other', label: 'Type is "other"' },
  ],
  guides: [
    { value: 'ready', label: 'Ready only' },
    { value: 'no-cover', label: 'No cover image' },
    { value: 'no-reviewer', label: 'No medical reviewer' },
    { value: 'no-description', label: 'No meta description' },
  ],
  news: [
    { value: 'ready', label: 'Ready only' },
    { value: 'no-cover', label: 'No cover image' },
    { value: 'no-description', label: 'No meta description' },
  ],
}

// ── styles ────────────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150, #e2e8f0)', borderRadius: 8,
  background: 'var(--theme-elevation-0, #fff)', padding: 16, marginBottom: 16,
}
const th: React.CSSProperties = {
  textAlign: 'left', padding: '8px 10px', opacity: 0.6, fontWeight: 600, fontSize: 10.5,
  textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
}
const td: React.CSSProperties = {
  padding: '9px 10px', fontSize: 13, borderTop: '1px solid var(--theme-elevation-100, #eef1f5)',
  verticalAlign: 'top',
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
const date = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : null

export function ContentIndexPanel() {
  const [tab, setTab] = useState<Tab>('clinics')
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [facets, setFacets] = useState<Facets | null>(null)
  const [labels, setLabels] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')

  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('name')
  const [importBatch, setImportBatch] = useState('')
  const [state, setState] = useState('')
  const [status, setStatus] = useState('')
  const [submitted, setSubmitted] = useState('')
  const [problem, setProblem] = useState('')
  const [q, setQ] = useState('')

  const [sitePages, setSitePages] = useState<SitePage[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [allMatching, setAllMatching] = useState(false)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [pending, setPending] = useState<{ action: string; matched: number; wouldChange: number } | null>(null)

  const filterQS = useMemo(() => {
    const p = new URLSearchParams()
    if (importBatch) p.set('importBatch', importBatch)
    if (state) p.set('state', state)
    if (status) p.set('status', status)
    if (submitted) p.set('submitted', submitted)
    if (problem) p.set('problem', problem)
    if (q.trim()) p.set('q', q.trim())
    return p
  }, [importBatch, state, status, submitted, problem, q])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (tab === 'static') {
        const res = await fetch('/api/admin/content-index?tab=static', { credentials: 'include' })
        const data = await res.json()
        if (!res.ok) { setMsg(data?.error ?? 'Could not load site pages.'); return }
        setSitePages(data.sitePages ?? [])
        setSummary(data.summary ?? null)
        return
      }

      const p = new URLSearchParams(filterQS)
      p.set('tab', tab); p.set('sort', sort); p.set('page', String(page)); p.set('limit', '50')
      const res = await fetch(`/api/admin/content-index?${p}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) { setMsg(data?.error ?? 'Could not load content.'); return }
      setRows(data.rows ?? [])
      setTotal(data.total ?? 0)
      setLabels(data.readinessLabels ?? [])
      if (data.summary) setSummary(data.summary)
      if (data.facets) setFacets(data.facets)
    } catch { setMsg('Network error.') }
    finally { setLoading(false) }
  }, [tab, sort, page, filterQS])

  useEffect(() => { load() }, [load])

  // Any filter or tab change invalidates a selection made against the old set.
  // Silently keeping it is how you index the wrong 500 rows.
  useEffect(() => {
    setSelected(new Set()); setAllMatching(false); setPending(null)
  }, [tab, filterQS])

  function toggleRow(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
    setAllMatching(false)
    setPending(null)
  }

  const selectionCount = allMatching ? total : selected.size

  async function runBulk(action: string, dryRun: boolean) {
    setBusy(`${action}:${dryRun ? 'dry' : 'go'}`); setMsg('')
    try {
      const res = await fetch('/api/admin/content-index', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tab, action, dryRun,
          ...(allMatching
            ? { allMatching: true, filters: Object.fromEntries(filterQS) }
            : { sourceIds: [...selected] }),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMsg(`${data?.error ?? 'Request failed.'}${data?.ref ? ` (ref ${data.ref})` : ''}`)
        return
      }
      if (dryRun) {
        setPending({ action, matched: data.matched, wouldChange: data.wouldChange })
        setMsg(`${fmt(data.matched)} match. This would ${action} ${fmt(data.wouldChange)}.`)
      } else {
        setPending(null); setSelected(new Set()); setAllMatching(false)
        setMsg(`Done: ${action} applied to ${fmt(data.changed)} url(s). ${data.note ?? ''}`)
        await load()
      }
    } catch { setMsg('Network error.') }
    finally { setBusy('') }
  }

  async function setSitePage(path: string, action: 'index' | 'exclude' | 'requeue') {
    setBusy(`site:${path}`); setMsg('')
    try {
      const res = await fetch('/api/admin/content-index', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tab: 'static', action, paths: [path], dryRun: false }),
      })
      const data = await res.json()
      if (!res.ok) { setMsg(data?.error ?? 'Could not update that page.'); return }
      await load()
    } catch { setMsg('Network error.') }
    finally { setBusy('') }
  }

  async function openDetail(sourceId: number) {
    try {
      const res = await fetch(`/api/admin/content-index?tab=${tab}&detail=${sourceId}`, { credentials: 'include' })
      const data = await res.json()
      if (res.ok) setDetail(data.detail)
    } catch { /* ignore */ }
  }

  const pages = Math.max(1, Math.ceil(total / 50))

  return (
    <>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.key} type="button"
            onClick={() => { setTab(t.key); setPage(1); setProblem(''); setSummary(null); setFacets(null) }}
            style={{
              padding: '7px 14px', borderRadius: 8, border: '1px solid transparent', fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
              background: tab === t.key ? '#0B1B34' : 'transparent',
              color: tab === t.key ? '#fff' : 'inherit',
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* Site pages: a checklist, not a table. Only ~39 rows and no filters. */}
      {tab === 'static' && (
        <>
          <div style={card}>
            <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
              <Stat label="Site pages" value={summary?.total} />
              <Stat label="Submitted to Google" value={summary?.submitted} tone="#3FA68A" />
              <Stat label="Not submitted" value={summary?.queued} />
              <Stat label="Never submit" value={summary?.excluded} />
            </div>
            <p style={{ margin: '12px 0 0', fontSize: 12.5, opacity: 0.75, maxWidth: 700 }}>
              The pages written by hand rather than generated from data. The ones marked
              &ldquo;Never submit&rdquo; are set that way in the codebase, with the reason shown, and
              cannot be turned on from here.
            </p>
          </div>

          {msg && <p style={{ ...card, margin: '0 0 16px', fontSize: 12.5, padding: '10px 14px' }}>{msg}</p>}

          <div style={card}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 720 }}>
                <thead>
                  <tr>
                    <th style={th}>Page</th><th style={th}>Url</th><th style={th}>In Google</th>
                    <th style={th}>Why not</th><th style={th} />
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td style={td} colSpan={5}>Loading…</td></tr>}
                  {!loading && sitePages.map((sp) => (
                    <tr key={sp.path}>
                      <td style={{ ...td, fontWeight: 600 }}>{sp.name}</td>
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{sp.path}</td>
                      <td style={td}>
                        {sp.indexed
                          ? <span style={{ fontSize: 11.5, fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: '#E6F2EE', color: '#3FA68A' }}>Submitted</span>
                          : !sp.indexable || sp.indexMode === 'excluded'
                            ? <span style={{ fontSize: 11.5, fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: '#FDECEC', color: '#B91C1C' }}>Never</span>
                            : <span style={{ fontSize: 11.5, fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: 'var(--theme-elevation-50, #f7f8fa)', opacity: 0.8 }}>Not submitted</span>}
                      </td>
                      <td style={{ ...td, fontSize: 12, opacity: 0.7, whiteSpace: 'normal', maxWidth: 320 }}>
                        {sp.note ?? (sp.rowId ? '' : 'Not in the registry yet — run a page scan')}
                      </td>
                      <td style={td}>
                        {sp.indexable && sp.rowId && (
                          sp.indexed
                            ? <button type="button" disabled={!!busy} onClick={() => setSitePage(sp.path, 'requeue')}
                                style={{ ...btn(!!busy, 'transparent', 'inherit'), border: '1px solid var(--theme-elevation-150, #e2e8f0)', padding: '4px 10px', fontSize: 12 }}>
                                Remove
                              </button>
                            : <button type="button" disabled={!!busy} onClick={() => setSitePage(sp.path, 'index')}
                                style={{ ...btn(!!busy, '#3FA68A'), padding: '4px 10px', fontSize: 12 }}>
                                Submit
                              </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab !== 'static' && <>
      {/* Summary */}
      <div style={card}>
        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
          <Stat label="Total" value={summary?.total} />
          <Stat label="Submitted to Google" value={summary?.submitted} tone="#3FA68A" />
          <Stat label="Not submitted" value={summary?.queued} />
          <Stat label="Ready to submit" value={summary?.ready} tone="#C2A14E" />
          <Stat label="Never submit" value={summary?.excluded} />
          <Stat label="No url built" value={summary?.unregistered} tone={summary?.unregistered ? '#B91C1C' : undefined} />
        </div>
        {!!summary?.unregistered && (
          <p style={{ margin: '12px 0 0', fontSize: 12.5, opacity: 0.75 }}>
            {fmt(summary.unregistered)} document(s) have no url at all. For clinics that means the
            city and state match no Location, so the scan could not build a path. They can never be
            indexed until that is fixed.
          </p>
        )}
      </div>

      {/* Filters */}
      <div style={card}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="Import batch">
            <select value={importBatch} onChange={(e) => { setImportBatch(e.target.value); setPage(1) }} style={input}>
              <option value="">All batches</option>
              {(facets?.importBatches ?? []).map((b) => (
                <option key={b.value} value={b.value}>{b.value} ({b.count.toLocaleString()})</option>
              ))}
            </select>
          </Field>

          {tab === 'clinics' && (
            <Field label="State">
              <select value={state} onChange={(e) => { setState(e.target.value); setPage(1) }} style={input}>
                <option value="">All states</option>
                {(facets?.states ?? []).map((s) => (
                  <option key={s.value} value={s.value}>{s.value} ({s.count.toLocaleString()})</option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Status">
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} style={input}>
              <option value="">Any</option>
              <option value="published">Published</option>
              <option value="review">Review</option>
              <option value="draft">Draft</option>
            </select>
          </Field>

          <Field label="In Google">
            <select value={submitted} onChange={(e) => { setSubmitted(e.target.value); setPage(1) }} style={input}>
              <option value="">Any</option>
              <option value="indexed">Submitted</option>
              <option value="queued">Not submitted</option>
              <option value="excluded">Never submit</option>
              <option value="unregistered">No url built</option>
            </select>
          </Field>

          <Field label="Problem">
            <select value={problem} onChange={(e) => { setProblem(e.target.value); setPage(1) }} style={input}>
              <option value="">Any</option>
              {PROBLEMS[tab].map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </Field>

          <Field label="Search name">
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} placeholder="name…" style={{ ...input, width: 150 }} />
          </Field>

          <Field label="Sort by">
            <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1) }} style={input}>
              <option value="name">Name</option>
              <option value="uploaded">Uploaded (newest)</option>
              <option value="published">Published (newest)</option>
              <option value="updated">Updated (newest)</option>
              {tab === 'clinics' && <option value="reviews">Most reviews</option>}
            </select>
          </Field>

          <button
            type="button"
            onClick={() => {
              setImportBatch(''); setState(''); setStatus(''); setSubmitted(''); setProblem(''); setQ(''); setPage(1)
            }}
            style={btn(false, 'transparent', 'inherit')}
          >Clear</button>
        </div>
      </div>

      {/* Selection bar */}
      {selectionCount > 0 && (
        <div style={{
          ...card, background: '#E6F2EE', borderColor: '#3FA68A',
          display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 13 }}>
            <strong>{fmt(selectionCount)}</strong> selected
            {allMatching && ' (everything matching this filter)'}
          </span>
          {!allMatching && total > selected.size && (
            <button
              type="button" onClick={() => { setAllMatching(true); setPending(null) }}
              style={{ background: 'none', border: 'none', color: '#3FA68A', fontWeight: 600, fontSize: 13, textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
            >Select all {fmt(total)} matching this filter</button>
          )}
          <span style={{ flex: 1 }} />
          <button type="button" onClick={() => runBulk('index', true)} disabled={!!busy} style={btn(!!busy, '#475569')}>
            {busy === 'index:dry' ? 'Checking…' : 'Check'}
          </button>
          <button
            type="button" onClick={() => runBulk('index', false)}
            disabled={!!busy || !pending || pending.action !== 'index'}
            style={btn(!!busy || !pending || pending.action !== 'index', '#3FA68A')}
          >
            {pending?.action === 'index' ? `Submit ${fmt(pending.wouldChange)}` : 'Submit (check first)'}
          </button>
          <button type="button" onClick={() => runBulk('requeue', false)} disabled={!!busy} style={btn(!!busy, 'transparent', 'inherit')}>
            Remove
          </button>
          <button
            type="button" onClick={() => runBulk('exclude', false)} disabled={!!busy}
            style={{ ...btn(!!busy, 'transparent'), color: '#B91C1C', border: '1px solid #fecaca' }}
          >Never submit</button>
          <button type="button" onClick={() => { setSelected(new Set()); setAllMatching(false); setPending(null) }}
            style={btn(false, 'transparent', 'inherit')}>Cancel</button>
        </div>
      )}

      {msg && (
        <p style={{ ...card, margin: '0 0 16px', fontSize: 12.5, padding: '10px 14px' }}>{msg}</p>
      )}

      {/* Table */}
      <div style={card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1000 }}>
            <thead>
              <tr>
                <th style={{ ...th, width: 26 }} />
                <th style={th}>Name</th>
                <th style={th}>In Google</th>
                <th style={th}>Status</th>
                <th style={th}>Uploaded</th>
                <th style={th}>Published</th>
                <th style={th}>Updated</th>
                <th style={th}>Import batch</th>
                <th style={th}>Ready?</th>
                <th style={th} />
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td style={td} colSpan={10}>Loading…</td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td style={td} colSpan={10}>Nothing matches this filter.</td></tr>
              )}
              {!loading && rows.map((r) => (
                <tr key={r.sourceId}>
                  <td style={td}>
                    <input
                      type="checkbox"
                      checked={allMatching || selected.has(r.sourceId)}
                      disabled={allMatching}
                      onChange={() => toggleRow(r.sourceId)}
                      aria-label={`Select ${r.name}`}
                    />
                  </td>
                  <td style={{ ...td, minWidth: 210 }}>
                    <span style={{ fontWeight: 600, display: 'block' }}>{r.name}</span>
                    <span style={{ fontSize: 11.5, opacity: 0.6 }}>
                      {r.city ? `${r.city}, ${r.state}` : r.subType}
                      {r.reviewCount ? ` · ${r.reviewCount.toLocaleString()} reviews` : ''}
                    </span>
                    {r.path
                      ? <span style={{ fontSize: 11, opacity: 0.5, fontFamily: 'monospace', display: 'block', wordBreak: 'break-all' }}>{r.path}</span>
                      : <span style={{ fontSize: 11, color: '#B91C1C', display: 'block' }}>No url built</span>}
                  </td>
                  <td style={td}><SubmittedPill row={r} /></td>
                  <td style={{ ...td, fontSize: 12 }}>{r.status}</td>
                  <td style={{ ...td, fontSize: 12, whiteSpace: 'nowrap' }}>{date(r.uploadedAt) ?? '—'}</td>
                  <td style={{ ...td, fontSize: 12, whiteSpace: 'nowrap', opacity: r.publishedAt ? 1 : 0.4 }}>{date(r.publishedAt) ?? '—'}</td>
                  <td style={{ ...td, fontSize: 12, whiteSpace: 'nowrap' }}>{date(r.updatedAt) ?? '—'}</td>
                  <td style={{ ...td, fontSize: 11, fontFamily: 'monospace' }}>{r.importBatch ?? '—'}</td>
                  <td style={td}><Dots values={r.readiness} labels={labels} /></td>
                  <td style={td}>
                    <button type="button" onClick={() => openDetail(r.sourceId)}
                      style={{ ...btn(false, 'transparent', 'inherit'), border: '1px solid var(--theme-elevation-150, #e2e8f0)', padding: '4px 10px', fontSize: 12 }}>
                      Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, opacity: 0.7 }}>
            {fmt(total)} item(s) · page {page} of {fmt(pages)}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
              style={btn(page <= 1, 'transparent', 'inherit')}>Previous</button>
            <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}
              style={btn(page >= pages, 'transparent', 'inherit')}>Next</button>
          </div>
        </div>
      </div>
      </>}

      {detail && <DetailDrawer detail={detail} labels={labels} onClose={() => setDetail(null)} />}
    </>
  )
}

function SubmittedPill({ row }: { row: Row }) {
  const base: React.CSSProperties = {
    fontSize: 11.5, fontWeight: 600, padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap',
  }
  if (row.indexed) return <span style={{ ...base, background: '#E6F2EE', color: '#3FA68A' }}>Submitted</span>
  if (row.indexMode === 'excluded') return <span style={{ ...base, background: '#FDECEC', color: '#B91C1C' }}>Never submit</span>
  if (!row.rowId) return <span style={{ ...base, background: '#FDECEC', color: '#B91C1C' }}>No url</span>
  return <span style={{ ...base, background: 'var(--theme-elevation-50, #f7f8fa)', opacity: 0.8 }}>Not submitted</span>
}

function Dots({ values, labels }: { values: boolean[]; labels: string[] }) {
  const on = values.filter(Boolean).length
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      {values.map((v, i) => (
        <span
          key={i}
          title={`${labels[i] ?? ''}: ${v ? 'present' : 'MISSING'}`}
          style={{
            width: 7, height: 7, borderRadius: 999,
            background: v ? '#3FA68A' : '#B91C1C', opacity: v ? 1 : 0.55,
          }}
        />
      ))}
      <span style={{ fontSize: 11.5, opacity: 0.6, marginLeft: 5 }}>{on}/{values.length}</span>
    </span>
  )
}

function DetailDrawer({ detail, labels, onClose }: { detail: Detail; labels: string[]; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const meter = (text: string, min: number, max: number) => {
    const n = text.length
    const bad = n > max || n < min
    return (
      <>
        <div style={{ height: 4, borderRadius: 999, background: '#eef1f5', overflow: 'hidden', marginTop: 4 }}>
          <div style={{ height: '100%', width: `${Math.min(100, (n / max) * 100)}%`, background: bad ? '#C2A14E' : '#3FA68A' }} />
        </div>
        <span style={{ fontSize: 11, opacity: 0.65 }}>
          {n} characters · {n > max ? 'too long, Google will cut it' : n < min ? 'shorter than ideal' : 'good length'}
        </span>
      </>
    )
  }

  const kv = (k: string, v: React.ReactNode) => (
    <div style={{ display: 'grid', gridTemplateColumns: '132px 1fr', gap: 8, fontSize: 13, padding: '3px 0' }}>
      <span style={{ opacity: 0.6 }}>{k}</span>
      <span style={{ wordBreak: 'break-word' }}>{v}</span>
    </div>
  )

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(11,27,52,.42)', zIndex: 60 }} />
      <aside
        role="dialog" aria-modal="true" aria-label={`Indexing detail for ${detail.name}`}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(520px, 100%)', zIndex: 61,
          background: 'var(--theme-elevation-0, #fff)', borderLeft: '1px solid var(--theme-elevation-150, #e2e8f0)',
          overflowY: 'auto', boxShadow: '0 12px 32px rgba(11,27,52,.16)',
        }}
      >
        <div style={{
          position: 'sticky', top: 0, background: 'var(--theme-elevation-0, #fff)', padding: '16px 18px',
          borderBottom: '1px solid var(--theme-elevation-150, #e2e8f0)', display: 'flex', gap: 12, alignItems: 'flex-start',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', opacity: 0.55 }}>
              Indexing detail
            </div>
            <strong style={{ fontSize: 15, display: 'block', marginTop: 3 }}>{detail.name}</strong>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ ...btn(false, 'transparent', 'inherit'), border: '1px solid var(--theme-elevation-150, #e2e8f0)', padding: '4px 10px' }}>
            ✕
          </button>
        </div>

        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Group title="Indexing">
            {kv('Status', detail.indexed ? 'Submitted to Google' : detail.indexMode === 'excluded' ? 'Never submit' : 'Not submitted')}
            {kv('Robots tag now', <code style={{ fontSize: 12 }}>{detail.robotsNow}</code>)}
            {kv('In sitemap', detail.indexed
              ? <>Yes, in <code style={{ fontSize: 12 }}>/sitemaps/{detail.sitemapChild}</code></>
              : <span style={{ opacity: 0.6 }}>No. Would go to <code style={{ fontSize: 12 }}>/sitemaps/{detail.sitemapChild}</code> once submitted.</span>)}
            {kv('Live on site', detail.publishable ? 'Yes' : 'No — nothing to show, so it can never be submitted')}
            {kv('Url', detail.path ? <code style={{ fontSize: 12 }}>{detail.path}</code> : <span style={{ color: '#B91C1C' }}>No url could be built</span>)}
            {kv('Batch', detail.batchLabel ?? <span style={{ opacity: 0.6 }}>Not in any batch</span>)}
            {kv('Submitted on', date(detail.indexedAt) ?? <span style={{ opacity: 0.6 }}>Never</span>)}
          </Group>

          <Group title="Metadata">
            {kv('Meta title', <>{detail.metaTitle}{meter(detail.metaTitle, 30, 60)}</>)}
            {kv('Meta description', detail.metaDescription
              ? <>{detail.metaDescription}{meter(detail.metaDescription, 110, 160)}</>
              : <span style={{ color: '#B91C1C' }}>Missing</span>)}
            {kv('Schema', <span style={{ fontSize: 12 }}>{detail.schema}</span>)}
            {detail.metaSource === 'generated' && (
              <p style={{ fontSize: 11.5, opacity: 0.6, margin: '6px 0 0' }}>
                Clinic meta is not stored in the database. It is built on every request from the
                name, city, state and description, so editing the description changes it.
              </p>
            )}
          </Group>

          <Group title="Readiness">
            {detail.readiness.map((ok, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '4px 0' }}>
                <span style={{
                  width: 16, height: 16, borderRadius: 999, display: 'grid', placeItems: 'center',
                  fontSize: 10, fontWeight: 700, color: '#fff', background: ok ? '#3FA68A' : '#B91C1C',
                }}>{ok ? '✓' : '✕'}</span>
                <span>{labels[i]}</span>
              </div>
            ))}
          </Group>

          <Group title="Dates">
            {kv('Uploaded', date(detail.uploadedAt) ?? '—')}
            {kv('Published', date(detail.publishedAt) ?? <span style={{ opacity: 0.6 }}>Not set</span>)}
            {kv('Last updated', date(detail.updatedAt) ?? '—')}
            {kv('Import batch', <code style={{ fontSize: 12 }}>{detail.importBatch ?? '—'}</code>)}
          </Group>

          <a href={detail.adminUrl} style={{ ...btn(false, '#0B1B34'), textDecoration: 'none', textAlign: 'center' }}>
            Open document
          </a>
        </div>
      </aside>
    </>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <h4 style={{
        margin: 0, paddingBottom: 6, borderBottom: '1px solid var(--theme-elevation-100, #eef1f5)',
        fontSize: 10.5, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', opacity: 0.55,
      }}>{title}</h4>
      {children}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value?: number; tone?: string }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: tone }}>{fmt(value)}</div>
      <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>{label}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 10.5, fontWeight: 600, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '.04em' }}>
        {label}
      </span>
      {children}
    </label>
  )
}
