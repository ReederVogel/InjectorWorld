'use client'

import { useEffect, useRef, useState } from 'react'
import { BranchSuggestions } from './BranchSuggestions'
import { DashboardNewsletterPanel } from './DashboardNewsletterPanel'
import { DashboardNewsSendPanel } from './DashboardNewsSendPanel'

type Counts = { created: number; updated: number; skipped: number }
type Report = {
  clinics: Counts
  providers: Counts
  reviews: Counts
  photos: Counts
  qa: Counts
  alerts: Array<{ severity: string; type: string; message: string }>
  dryRun?: boolean
  batch?: string
}

const box: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150, #e2e8f0)',
  borderRadius: 8,
  padding: 20,
  marginBottom: 16,
  background: 'var(--theme-elevation-50, #fff)',
}

const ALERTS_OPEN = '/admin/collections/data-alerts?where[or][0][and][0][status][equals]=open'
const LEADS_NEW = '/admin/collections/bookings?where[or][0][and][0][status][equals]=new'

export function DashboardWidget() {
  const [openAlerts, setOpenAlerts] = useState<number | null>(null)
  const [errorAlerts, setErrorAlerts] = useState<number>(0)
  const [newBookings, setNewBookings] = useState<number | null>(null)
  const [oldestBooking, setOldestBooking] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [confirmedSubs, setConfirmedSubs] = useState<number>(0)

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

  async function loadBookings() {
    try {
      const res = await fetch(
        '/api/bookings?where[status][equals]=new&limit=1&sort=createdAt&depth=0',
        { credentials: 'include' },
      )
      const json = await res.json()
      setNewBookings(json.totalDocs ?? 0)
      setOldestBooking(json.docs?.[0]?.createdAt ?? null)
    } catch {
      setNewBookings(null)
    }
  }

  async function loadSubscribers() {
    try {
      const res = await fetch('/api/subscribers?where[status][equals]=confirmed&limit=0&depth=0', { credentials: 'include' })
      const json = await res.json()
      setConfirmedSubs(json.totalDocs ?? 0)
    } catch { /* non-fatal */ }
  }

  useEffect(() => {
    loadAlertCounts()
    loadBookings()
    loadSubscribers()
  }, [])

  const oldestDays =
    newBookings && oldestBooking
      ? Math.floor((Date.now() - new Date(oldestBooking).getTime()) / 86400000)
      : 0
  const staleLeads = (newBookings ?? 0) > 0 && oldestDays >= 2
  const priorities: string[] = []
  if (errorAlerts > 0) priorities.push(`${errorAlerts} data error${errorAlerts === 1 ? '' : 's'} need fixing`)
  if (staleLeads) priorities.push(`a lead has been waiting ${oldestDays} days`)
  const allClear = openAlerts === 0 && (newBookings ?? 0) === 0

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Operations</h2>
        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          style={{
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: 'none', border: 'none', color: 'var(--theme-text, #0B1B34)',
            textDecoration: 'underline', padding: 0,
          }}
        >
          {showHelp ? 'Hide how this works' : 'How this works'}
        </button>
      </div>

      <div
        style={{
          ...box,
          borderLeft: `4px solid ${priorities.length ? '#B91C1C' : allClear ? '#3FA68A' : '#C2A14E'}`,
        }}
      >
        {priorities.length > 0 ? (
          <div>
            <strong style={{ fontSize: 15 }}>Needs you now</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13 }}>
              {errorAlerts > 0 && (
                <li><a href={ALERTS_OPEN} style={{ color: 'inherit' }}>{errorAlerts} data error{errorAlerts === 1 ? '' : 's'} need fixing →</a></li>
              )}
              {staleLeads && (
                <li><a href={LEADS_NEW} style={{ color: 'inherit' }}>A lead has been waiting {oldestDays} days →</a></li>
              )}
            </ul>
          </div>
        ) : allClear ? (
          <div style={{ fontSize: 13 }}><strong style={{ fontSize: 15 }}>All clear.</strong> No open alerts and no unactioned leads.</div>
        ) : (
          <div style={{ fontSize: 13 }}>
            <strong style={{ fontSize: 15 }}>Nothing urgent.</strong>{' '}
            {openAlerts ? `${openAlerts} open alert${openAlerts === 1 ? '' : 's'} to review. ` : ''}
            {newBookings ? `${newBookings} new lead${newBookings === 1 ? '' : 's'} to action.` : ''}
          </div>
        )}
      </div>

      <div style={{ ...box, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <QuickAction href="#data-tools" label="Data tools" />
        <QuickAction href="#bulk-import" label="Import data" />
        <QuickAction href="/admin/collections/locations" label="Manage markets" />
        <QuickAction href="/admin/collections/promotions/create" label="New promotion" />
        <QuickAction href={LEADS_NEW} label="Review leads" />
        <QuickAction href={ALERTS_OPEN} label="Resolve alerts" />
        <QuickAction href="/" label="View live site" external />
      </div>

      {showHelp && (
        <div style={box}>
          <strong style={{ fontSize: 15 }}>How this works</strong>
          <dl style={{ fontSize: 13, margin: '10px 0 0' }}>
            {HELP.map(([term, desc]) => (
              <div key={term} style={{ marginBottom: 10 }}>
                <dt style={{ fontWeight: 600 }}>{term}</dt>
                <dd style={{ margin: '2px 0 0', opacity: 0.85 }}>{desc}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

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
          <a href={ALERTS_OPEN} style={pill}>View alerts →</a>
        </div>
      </div>

      {(() => {
        const has = (newBookings ?? 0) > 0
        let oldestLabel = ''
        if (has && oldestBooking) {
          oldestLabel = oldestDays <= 0 ? 'oldest arrived today' : `oldest waiting ${oldestDays} day${oldestDays === 1 ? '' : 's'}`
        }
        return (
          <div style={{ ...box, borderLeft: `4px solid ${staleLeads ? '#B91C1C' : has ? '#C2A14E' : '#3FA68A'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <strong style={{ fontSize: 15 }}>New leads</strong>
                <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
                  {newBookings === null
                    ? 'Could not load bookings.'
                    : newBookings === 0
                    ? 'No new leads. All bookings actioned.'
                    : `${newBookings} new booking${newBookings === 1 ? '' : 's'} awaiting action${oldestLabel ? ` (${oldestLabel})` : ''}.`}
                </div>
              </div>
              <a href={LEADS_NEW} style={pill}>View leads →</a>
            </div>
          </div>
        )
      })()}

      <ImportPanel onAfterImport={loadAlertCounts} />
      <ContentImportPanel collection="news" label="News articles" onAfterImport={loadAlertCounts} />
      <ContentImportPanel collection="guides" label="Guides" onAfterImport={loadAlertCounts} />
      <ContentReviewPanel />
      <DripIndexPanel />
      <BranchSuggestions onAfterChange={loadAlertCounts} />
      <DataToolsPanel onAfterChange={loadAlertCounts} />

      <div id="newsletter" style={box}>
        <strong style={{ fontSize: 15 }}>Newsletter broadcast</strong>
        <div style={{ fontSize: 13, opacity: 0.8, margin: '4px 0 14px' }}>
          Send a plain-text email to confirmed subscribers. An unsubscribe link is added automatically.
          Set RESEND_API_KEY to send real mail (falls back to console log).
        </div>
        <DashboardNewsletterPanel confirmedCount={confirmedSubs} />
      </div>

      <div id="news-send" style={box}>
        <strong style={{ fontSize: 15 }}>Send news article to subscribers</strong>
        <div style={{ fontSize: 13, opacity: 0.8, margin: '4px 0 14px' }}>
          Notify subscribers about a published news article. The email is auto-composed from the article title and excerpt.
        </div>
        <DashboardNewsSendPanel confirmedCount={confirmedSubs} />
      </div>
    </div>
  )
}

// ── Bulk import (combined or separate files, with dry-run preview) ────────────
function ImportPanel({ onAfterImport }: { onAfterImport: () => void }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Report | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [wasDryRun, setWasDryRun] = useState(false)

  async function submit(dryRun: boolean) {
    if (!formRef.current) return
    setBusy(true)
    setErrorMsg('')
    try {
      const fd = new FormData(formRef.current)
      fd.set('dryRun', dryRun ? 'true' : 'false')
      const res = await fetch('/api/admin/import', { method: 'POST', body: fd, credentials: 'include' })
      const json = await res.json()
      if (!res.ok) { setErrorMsg(json.error || 'Import failed.'); setResult(null); return }
      setResult(json.report)
      setWasDryRun(json.report?.dryRun === true)
      if (!dryRun) onAfterImport()
    } catch {
      setErrorMsg('Network error during import.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div id="bulk-import" style={box}>
      <strong style={{ fontSize: 15 }}>Bulk import (CSV)</strong>
      <div style={{ fontSize: 13, opacity: 0.8, margin: '4px 0 14px' }}>
        Upload ONE combined CSV (with a <code>record_type</code> column), or separate clinics / providers /
        reviews / photos / Q&amp;A files (schema: <code>data/scraper-brief.md</code>). Existing rows update by id.
        Preview first with dry run, then commit.
      </div>
      <form ref={formRef} onSubmit={(e) => { e.preventDefault(); submit(true) }}>
        <div style={{ display: 'grid', gap: 10, maxWidth: 460 }}>
          <label style={{ fontSize: 13 }}>Combined CSV (record_type column)
            <input name="combined" type="file" accept=".csv" style={{ display: 'block', marginTop: 4 }} />
          </label>
          <div style={{ fontSize: 12, opacity: 0.6 }}>or separate files</div>
          <label style={{ fontSize: 13 }}>Clinics CSV
            <input name="clinics" type="file" accept=".csv" style={{ display: 'block', marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 13 }}>Providers CSV
            <input name="providers" type="file" accept=".csv" style={{ display: 'block', marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 13 }}>Reviews CSV
            <input name="reviews" type="file" accept=".csv" style={{ display: 'block', marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 13 }}>Photos CSV
            <input name="photos" type="file" accept=".csv" style={{ display: 'block', marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 13 }}>Q&amp;A CSV
            <input name="qa" type="file" accept=".csv" style={{ display: 'block', marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 13 }}>Batch label (optional)
            <input name="batch" type="text" placeholder="e.g. fake-2026-06" style={{ display: 'block', marginTop: 4, width: '100%', padding: '6px 8px' }} />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <button type="submit" disabled={busy} style={btn(busy)}>
            {busy ? 'Working…' : 'Dry run (preview)'}
          </button>
          {wasDryRun && result && (
            <button type="button" disabled={busy} onClick={() => submit(false)} style={btn(busy, '#3FA68A')}>
              Commit import (write to database)
            </button>
          )}
        </div>
      </form>

      {errorMsg && <p style={{ color: '#B91C1C', fontSize: 13, marginTop: 12 }}>{errorMsg}</p>}
      {result && <ReportView report={result} />}
    </div>
  )
}

function ReportView({ report }: { report: Report }) {
  return (
    <div style={{ marginTop: 16, fontSize: 13 }}>
      {report.dryRun && (
        <div style={{ fontWeight: 600, color: '#92710f', marginBottom: 8 }}>
          Dry run: nothing was written. Review below, then Commit.
        </div>
      )}
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        {(['clinics', 'providers', 'reviews', 'photos', 'qa'] as const).map((k) => (
          <span key={k}>
            {k}: <strong>{report[k].created}</strong> new, {report[k].updated} updated, {report[k].skipped} skipped
          </span>
        ))}
      </div>
      {report.alerts.length > 0 && (
        <ul style={{ marginTop: 12, paddingLeft: 18, maxHeight: 240, overflow: 'auto' }}>
          {report.alerts.map((a, i) => (
            <li key={i} style={{ marginBottom: 4, color: a.severity === 'error' ? '#B91C1C' : a.severity === 'warning' ? '#92710f' : 'inherit' }}>
              [{a.severity}] {a.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Data tools: backup, re-scan, scoped wipe ─────────────────────────────────
function DataToolsPanel({ onAfterChange }: { onAfterChange: () => void }) {
  const [lastBackup, setLastBackup] = useState<{ file: string; mtime: string } | null | undefined>(undefined)
  const [busy, setBusy] = useState<string>('')
  const [msg, setMsg] = useState<string>('')

  // Wipe state
  const [scope, setScope] = useState<'directory' | 'state'>('directory')
  const [state, setState] = useState('CA')
  const [confirm, setConfirm] = useState('')
  const [wipePreview, setWipePreview] = useState<Record<string, number> | null>(null)
  const [wipeTotal, setWipeTotal] = useState<number | null>(null)

  async function loadLastBackup() {
    try {
      const res = await fetch('/api/admin/backup', { credentials: 'include' })
      const json = await res.json()
      setLastBackup(json.last ?? null)
    } catch {
      setLastBackup(null)
    }
  }
  useEffect(() => { loadLastBackup() }, [])

  async function doBackup() {
    setBusy('backup'); setMsg('')
    try {
      const res = await fetch('/api/admin/backup', { method: 'POST', credentials: 'include' })
      const json = await res.json()
      if (!res.ok) setMsg(json.error || 'Backup failed.')
      else { setMsg(`Backup written: ${json.file}`); loadLastBackup() }
    } catch { setMsg('Network error during backup.') } finally { setBusy('') }
  }

  async function doScan() {
    setBusy('scan'); setMsg('')
    try {
      const res = await fetch('/api/admin/scan', { method: 'POST', credentials: 'include' })
      const json = await res.json()
      if (!res.ok) setMsg(json.error || 'Scan failed.')
      else {
        const sev = json.bySeverity || {}
        setMsg(`Scan complete: ${json.upserted} alerts (error ${sev.error ?? 0}, warning ${sev.warning ?? 0}, info ${sev.info ?? 0}).`)
        onAfterChange()
      }
    } catch { setMsg('Network error during scan.') } finally { setBusy('') }
  }

  const expectedPhrase = scope === 'directory' ? 'WIPE DIRECTORY' : `WIPE STATE ${state.toUpperCase()}`

  async function wipe(dryRun: boolean) {
    setBusy(dryRun ? 'wipe-preview' : 'wipe'); setMsg('')
    try {
      const res = await fetch('/api/admin/wipe', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, state: scope === 'state' ? state : undefined, dryRun, confirm: dryRun ? undefined : confirm }),
      })
      const json = await res.json()
      if (!res.ok) { setMsg(json.error || 'Wipe failed.'); return }
      setWipePreview(json.result.counts)
      setWipeTotal(json.result.total)
      if (dryRun) {
        setMsg(`Dry run: ${json.result.total} rows would be deleted. Type the phrase and confirm to proceed.`)
      } else {
        setMsg(`Wipe complete: ${json.result.total} rows deleted. Backup: ${json.backupFile ?? 'n/a'}.`)
        setConfirm('')
        loadLastBackup()
        onAfterChange()
      }
    } catch { setMsg('Network error during wipe.') } finally { setBusy('') }
  }

  return (
    <div id="data-tools" style={{ ...box, borderLeft: '4px solid #C2A14E' }}>
      <strong style={{ fontSize: 15 }}>Data tools</strong>
      <div style={{ fontSize: 13, opacity: 0.8, margin: '4px 0 14px' }}>
        Back up, re-scan integrity, and reset directory data (for the launch-day fake → real swap). Every action is admin-only and logged.
      </div>

      {/* Backup + scan row */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <button type="button" disabled={!!busy} onClick={doBackup} style={btn(busy === 'backup')}>
          {busy === 'backup' ? 'Backing up…' : 'Back up now'}
        </button>
        <button type="button" disabled={!!busy} onClick={doScan} style={btn(busy === 'scan')}>
          {busy === 'scan' ? 'Scanning…' : 'Re-scan alerts'}
        </button>
        <span style={{ fontSize: 12, opacity: 0.75 }}>
          {lastBackup === undefined ? 'Loading last backup…'
            : lastBackup === null ? 'No backup yet.'
            : `Last backup: ${new Date(lastBackup.mtime).toLocaleString()} (${lastBackup.file})`}
        </span>
      </div>

      {/* Wipe */}
      <div style={{ border: '1px solid #B91C1C33', borderRadius: 8, padding: 14, background: '#B91C1C0a' }}>
        <strong style={{ fontSize: 14, color: '#B91C1C' }}>Wipe directory data (destructive)</strong>
        <div style={{ fontSize: 12, opacity: 0.8, margin: '4px 0 12px' }}>
          Deletes clinics, providers, reviews, photos, Q&amp;A, before/after, bookings, claims, promotions, and alerts.
          Preserves users, treatments, locations, guides, authors, reviewers, FAQs, media. An automatic backup is taken before any real wipe.
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 10 }}>
          <label style={{ fontSize: 13 }}>Scope
            <select value={scope} onChange={(e) => { setScope(e.target.value as any); setWipePreview(null); setConfirm('') }} style={{ display: 'block', marginTop: 4, padding: '6px 8px' }}>
              <option value="directory">Directory (all)</option>
              <option value="state">By state</option>
            </select>
          </label>
          {scope === 'state' && (
            <label style={{ fontSize: 13 }}>State code
              <input value={state} onChange={(e) => { setState(e.target.value.toUpperCase()); setWipePreview(null); setConfirm('') }} maxLength={2} style={{ display: 'block', marginTop: 4, width: 70, padding: '6px 8px' }} />
            </label>
          )}
          <button type="button" disabled={!!busy} onClick={() => wipe(true)} style={btn(busy === 'wipe-preview')}>
            {busy === 'wipe-preview' ? 'Previewing…' : 'Preview wipe'}
          </button>
        </div>

        {wipePreview && (
          <div style={{ fontSize: 13, marginBottom: 10 }}>
            <div style={{ fontWeight: 600 }}>{wipeTotal} rows in scope:</div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 4 }}>
              {Object.entries(wipePreview).map(([k, n]) => <span key={k}>{k}: <strong>{n}</strong></span>)}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ fontSize: 13, flex: 1, minWidth: 240 }}>
            Type <code>{expectedPhrase}</code> to enable
            <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={expectedPhrase} style={{ display: 'block', marginTop: 4, width: '100%', padding: '6px 8px' }} />
          </label>
          <button
            type="button"
            disabled={!!busy || confirm.trim() !== expectedPhrase}
            onClick={() => wipe(false)}
            style={btn(busy === 'wipe', '#B91C1C', confirm.trim() !== expectedPhrase)}
          >
            {busy === 'wipe' ? 'Wiping…' : 'Wipe now'}
          </button>
        </div>
      </div>

      {msg && <p style={{ fontSize: 13, marginTop: 12 }}>{msg}</p>}
    </div>
  )
}

const pill: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, textDecoration: 'none',
  padding: '8px 14px', borderRadius: 999,
  background: 'var(--theme-elevation-100, #f1f5f9)', color: 'inherit',
}

function btn(busy: boolean, bg = '#0B1B34', disabled = false): React.CSSProperties {
  const off = busy || disabled
  return {
    padding: '9px 18px', borderRadius: 999, border: 'none', cursor: off ? 'default' : 'pointer',
    background: bg, color: '#fff', fontSize: 13, fontWeight: 600, opacity: off ? 0.55 : 1,
  }
}

function QuickAction({ href, label, external }: { href: string; label: string; external?: boolean }) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      style={{
        fontSize: 13, fontWeight: 600, textDecoration: 'none',
        padding: '9px 14px', borderRadius: 8,
        background: 'var(--theme-elevation-100, #f1f5f9)',
        border: '1px solid var(--theme-elevation-150, #e2e8f0)',
        color: 'var(--theme-text, #0B1B34)',
      }}
    >
      {label}
    </a>
  )
}

// ── Shared content import helper ─────────────────────────────────────────────
type SingleCollectionReport = {
  collection: string
  items: { created: number; updated: number; skipped: number }
  alerts: Array<{ severity: string; type: string; message: string }>
  dryRun?: boolean
  batch?: string
}

function ContentImportPanel({
  collection,
  label,
  onAfterImport,
}: {
  collection: 'news' | 'guides'
  label: string
  onAfterImport: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const batchRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<SingleCollectionReport | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [wasDryRun, setWasDryRun] = useState(false)

  async function submit(dryRun: boolean) {
    const file = fileRef.current?.files?.[0]
    if (!file) { setErrorMsg('Select a JSON file first.'); return }
    setBusy(true); setErrorMsg('')
    try {
      const fd = new FormData()
      fd.set('file', file)
      fd.set('collection', collection)
      fd.set('dryRun', dryRun ? 'true' : 'false')
      const batch = batchRef.current?.value.trim()
      if (batch) fd.set('batch', batch)
      const res = await fetch('/api/admin/content-import', { method: 'POST', body: fd, credentials: 'include' })
      const json = await res.json()
      if (!res.ok) { setErrorMsg(json.error || 'Import failed.'); setResult(null); return }
      setResult(json.report)
      setWasDryRun(json.report?.dryRun === true)
      if (!dryRun) onAfterImport()
    } catch {
      setErrorMsg('Network error.')
    } finally {
      setBusy(false)
    }
  }

  const id = `content-import-${collection}`

  return (
    <div id={id} style={{ ...box, borderLeft: '4px solid #3FA68A' }}>
      <strong style={{ fontSize: 15 }}>{label} — bulk import (JSON)</strong>
      <div style={{ fontSize: 13, opacity: 0.8, margin: '4px 0 14px' }}>
        Upload an AI-generated JSON file. Items land as <em>imported</em> (private, 404 on site).
        Dry run first to check counts and warnings, then commit.
      </div>
      <div style={{ display: 'grid', gap: 10, maxWidth: 460 }}>
        <label style={{ fontSize: 13 }}>JSON file
          <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'block', marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 13 }}>Batch label (optional — helps you find these later)
          <input ref={batchRef} type="text" placeholder={`e.g. ai-${collection}-2026-06`} style={{ display: 'block', marginTop: 4, width: '100%', padding: '6px 8px' }} />
        </label>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        <button type="button" disabled={busy} onClick={() => submit(true)} style={btn(busy)}>
          {busy ? 'Working…' : 'Dry run (preview)'}
        </button>
        {wasDryRun && result && (
          <button type="button" disabled={busy} onClick={() => submit(false)} style={btn(busy, '#3FA68A')}>
            Commit import (write to DB)
          </button>
        )}
      </div>
      {errorMsg && <p style={{ color: '#B91C1C', fontSize: 13, marginTop: 10 }}>{errorMsg}</p>}
      {result && (
        <div style={{ marginTop: 14, fontSize: 13 }}>
          {result.dryRun && (
            <div style={{ fontWeight: 600, color: '#92710f', marginBottom: 8 }}>
              Dry run only — nothing written yet. Review, then Commit.
            </div>
          )}
          {result.batch && <div style={{ opacity: 0.7, marginBottom: 6 }}>Batch: <code>{result.batch}</code></div>}
          <div style={{ marginBottom: 8 }}>
            <strong>{result.items.created}</strong> new, {result.items.updated} updated, {result.items.skipped} skipped
          </div>
          {result.alerts.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18, maxHeight: 220, overflow: 'auto' }}>
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
  )
}

// ── Content review: see each item, select, approve ────────────────────────────
type ReviewItem = {
  id: number
  title: string
  slug: string
  reviewStatus: string
  importBatch: string | null
  createdAt: string
  category: string | null
  excerpt: string | null
}

function ContentReviewPanel() {
  const [tab, setTab] = useState<'guides' | 'news'>('guides')
  const [items, setItems] = useState<ReviewItem[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [pendingCounts, setPendingCounts] = useState<{ news: number; guides: number } | null>(null)
  const [noindexCounts, setNoindexCounts] = useState<{ news: number; guides: number } | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  async function loadItems(collection: 'guides' | 'news', p: number) {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/content-approve?collection=${collection}&page=${p}`, { credentials: 'include' })
      const json = await res.json()
      setItems(json.items ?? [])
      setTotalItems(json.totalItems ?? 0)
      setTotalPages(json.totalPages ?? 1)
      setPendingCounts(json.pending ?? null)
      setNoindexCounts(json.approvedNoindex ?? null)
      setSelected(new Set())
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { setPage(1); loadItems(tab, 1) }, [tab])

  function toggleItem(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function selectAll() {
    if (selected.size === items.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(items.map((i) => i.id)))
    }
  }

  async function approveSelected() {
    if (selected.size === 0) { setMsg('Select at least one item.'); return }
    setBusy(true); setMsg('')
    try {
      const res = await fetch('/api/admin/content-approve', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: tab, ids: Array.from(selected) }),
      })
      const json = await res.json()
      if (!res.ok) { setMsg(json.error || 'Approve failed.'); return }
      setMsg(`${json.approved} item${json.approved === 1 ? '' : 's'} approved. They are now live but noindex.`)
      loadItems(tab, page)
    } catch {
      setMsg('Network error.')
    } finally {
      setBusy(false)
    }
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
    borderBottom: active ? '2px solid #3FA68A' : '2px solid transparent',
    background: 'none', color: active ? '#3FA68A' : 'inherit', marginBottom: -1,
  })

  return (
    <div id="content-review" style={{ ...box, borderLeft: '4px solid #3FA68A' }}>
      <strong style={{ fontSize: 15 }}>Content review</strong>
      <div style={{ fontSize: 13, opacity: 0.8, margin: '4px 0 10px' }}>
        Imported items are private until approved. After approval they go live but noindex (Google cannot crawl them yet). Use Drip indexer below to let them in gradually.
      </div>

      {/* Summary counts */}
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13, marginBottom: 14, padding: '10px 14px', background: 'var(--theme-elevation-100, #f8fafc)', borderRadius: 6 }}>
        <span>Pending review: <strong>{pendingCounts ? pendingCounts.guides : '–'}</strong> guides, <strong>{pendingCounts ? pendingCounts.news : '–'}</strong> news</span>
        <span>Approved (noindex): <strong>{noindexCounts ? noindexCounts.guides : '–'}</strong> guides, <strong>{noindexCounts ? noindexCounts.news : '–'}</strong> news</span>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid var(--theme-elevation-150, #e2e8f0)', marginBottom: 14, display: 'flex', gap: 4 }}>
        <button type="button" style={tabStyle(tab === 'guides')} onClick={() => setTab('guides')}>Guides</button>
        <button type="button" style={tabStyle(tab === 'news')} onClick={() => setTab('news')}>News</button>
      </div>

      {/* Item list */}
      {loading ? (
        <div style={{ fontSize: 13, opacity: 0.6, padding: '8px 0' }}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ fontSize: 13, opacity: 0.6, padding: '8px 0' }}>No pending items in {tab}.</div>
      ) : (
        <>
          {/* Select all row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, fontSize: 13 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 600 }}>
              <input type="checkbox" checked={selected.size === items.length && items.length > 0} onChange={selectAll} />
              Select all on this page ({items.length})
            </label>
            <span style={{ opacity: 0.6 }}>{totalItems} total pending</span>
          </div>

          {/* Items */}
          <div style={{ border: '1px solid var(--theme-elevation-150, #e2e8f0)', borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
            {items.map((item, idx) => (
              <label
                key={item.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                  cursor: 'pointer', fontSize: 13,
                  background: selected.has(item.id) ? '#e6f2ee' : idx % 2 === 0 ? 'var(--theme-elevation-50, #fff)' : 'var(--theme-elevation-100, #f8fafc)',
                  borderTop: idx > 0 ? '1px solid var(--theme-elevation-150, #e2e8f0)' : 'none',
                }}
              >
                <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleItem(item.id)} style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.title}
                  </div>
                  <div style={{ opacity: 0.65, fontSize: 12 }}>
                    /{tab === 'guides' ? 'guides' : 'news'}/{item.slug}
                    {item.category ? ` · ${item.category}` : ''}
                    {item.importBatch ? ` · batch: ${item.importBatch}` : ''}
                    {' · '}{new Date(item.createdAt).toLocaleDateString()}
                  </div>
                  {item.excerpt && (
                    <div style={{ opacity: 0.75, fontSize: 12, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.excerpt}
                    </div>
                  )}
                </div>
                <span style={{
                  flexShrink: 0, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                  background: item.reviewStatus === 'in-review' ? '#fef3c7' : '#e2e8f0',
                  color: item.reviewStatus === 'in-review' ? '#92710f' : '#475569',
                }}>
                  {item.reviewStatus}
                </span>
              </label>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 12 }}>
              <button type="button" disabled={page === 1} onClick={() => { const p = page - 1; setPage(p); loadItems(tab, p) }} style={btn(page === 1)}>Prev</button>
              <span>Page {page} / {totalPages}</span>
              <button type="button" disabled={page === totalPages} onClick={() => { const p = page + 1; setPage(p); loadItems(tab, p) }} style={btn(page === totalPages)}>Next</button>
            </div>
          )}

          {/* Approve bar */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" disabled={busy || selected.size === 0} onClick={approveSelected} style={btn(busy || selected.size === 0, '#3FA68A')}>
              {busy ? 'Approving…' : `Approve selected (${selected.size})`}
            </button>
            {selected.size > 0 && (
              <span style={{ fontSize: 12, opacity: 0.7 }}>
                Will be published but noindex. Google cannot crawl until you drip-index.
              </span>
            )}
          </div>
        </>
      )}

      {msg && <p style={{ fontSize: 13, marginTop: 10 }}>{msg}</p>}
    </div>
  )
}

// ── Drip indexer: see the queue, then index N items ───────────────────────────
type DripItem = { id: number; title: string; slug: string; approvedAt: string; category: string | null }

function DripIndexPanel() {
  const [tab, setTab] = useState<'guides' | 'news'>('guides')
  const [queue, setQueue] = useState<DripItem[]>([])
  const [remaining, setRemaining] = useState<number | null>(null)
  const [count, setCount] = useState('5')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  async function loadQueue(collection: 'guides' | 'news') {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/drip-index?collection=${collection}`, { credentials: 'include' })
      const json = await res.json()
      setQueue(json.items ?? [])
      setRemaining(json.remaining ?? null)
    } catch {
      setQueue([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadQueue(tab) }, [tab])

  async function dripIndex() {
    const n = Math.max(1, parseInt(count, 10) || 5)
    setBusy(true); setMsg('')
    try {
      const res = await fetch('/api/admin/drip-index', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: tab, count: n }),
      })
      const json = await res.json()
      if (!res.ok) { setMsg(json.error || 'Drip failed.'); return }
      setMsg(json.message || `${json.indexed} items indexed.`)
      loadQueue(tab)
    } catch {
      setMsg('Network error.')
    } finally {
      setBusy(false)
    }
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
    borderBottom: active ? '2px solid #3FA68A' : '2px solid transparent',
    background: 'none', color: active ? '#3FA68A' : 'inherit', marginBottom: -1,
  })

  return (
    <div id="drip-index" style={{ ...box, borderLeft: '4px solid #3FA68A' }}>
      <strong style={{ fontSize: 15 }}>Drip indexer</strong>
      <div style={{ fontSize: 13, opacity: 0.8, margin: '4px 0 14px' }}>
        Flip the oldest approved+noindex items to indexed so Google can crawl them. Aim for 5-10 per day per collection to avoid a sudden mass-index signal. CLI: <code>npm run drip:index -- guides --count=5</code>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid var(--theme-elevation-150, #e2e8f0)', marginBottom: 14, display: 'flex', gap: 4 }}>
        <button type="button" style={tabStyle(tab === 'guides')} onClick={() => setTab('guides')}>Guides</button>
        <button type="button" style={tabStyle(tab === 'news')} onClick={() => setTab('news')}>News</button>
      </div>

      {/* Queue preview */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
          {remaining === null ? 'Loading queue…' : `${remaining} item${remaining === 1 ? '' : 's'} waiting to be indexed (oldest first):`}
        </div>
        {loading ? (
          <div style={{ fontSize: 13, opacity: 0.6 }}>Loading…</div>
        ) : queue.length === 0 ? (
          <div style={{ fontSize: 13, opacity: 0.6 }}>Queue is empty — nothing to index.</div>
        ) : (
          <div style={{ border: '1px solid var(--theme-elevation-150, #e2e8f0)', borderRadius: 6, overflow: 'hidden' }}>
            {queue.slice(0, 10).map((item, idx) => (
              <div
                key={item.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', fontSize: 13,
                  background: idx % 2 === 0 ? 'var(--theme-elevation-50, #fff)' : 'var(--theme-elevation-100, #f8fafc)',
                  borderTop: idx > 0 ? '1px solid var(--theme-elevation-150, #e2e8f0)' : 'none',
                }}
              >
                <span style={{ flexShrink: 0, fontWeight: 700, color: '#94A3B8', width: 22, textAlign: 'right' }}>{idx + 1}.</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                  <div style={{ fontSize: 12, opacity: 0.65 }}>
                    /{tab === 'guides' ? 'guides' : 'news'}/{item.slug}
                    {item.category ? ` · ${item.category}` : ''}
                    {' · approved '}{new Date(item.approvedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
            {queue.length > 10 && (
              <div style={{ padding: '8px 12px', fontSize: 12, opacity: 0.6, borderTop: '1px solid var(--theme-elevation-150, #e2e8f0)' }}>
                +{queue.length - 10} more (showing first 10 of {remaining})
              </div>
            )}
          </div>
        )}
      </div>

      {/* Index controls */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ fontSize: 13 }}>How many to index now
          <input
            type="number" min={1} max={100} value={count}
            onChange={(e) => setCount(e.target.value)}
            style={{ display: 'block', marginTop: 4, width: 80, padding: '6px 8px' }}
          />
        </label>
        <button type="button" disabled={busy || queue.length === 0} onClick={dripIndex} style={btn(busy || queue.length === 0, '#3FA68A')}>
          {busy ? 'Indexing…' : `Index oldest ${Math.min(parseInt(count, 10) || 5, remaining ?? 0)}`}
        </button>
      </div>
      {msg && <p style={{ fontSize: 13, marginTop: 10 }}>{msg}</p>}
    </div>
  )
}

const HELP: Array<[string, string]> = [
  ['Import directory data', 'Use Bulk import. Upload one combined CSV (record_type column) or separate files. Dry run previews counts and alerts; Commit writes. Existing rows update by id; problems become data alerts.'],
  ['Back up / restore', 'Data tools → Back up now writes a timestamped dump. Restore from a terminal with npm run db:restore. A backup is taken automatically before any wipe.'],
  ['Wipe + reload (launch swap)', 'Data tools → Wipe directory data clears the fake directory so you can import real data. Preview first, then type the confirmation phrase. Users, treatments, locations, and guides are preserved.'],
  ['Set a market live', 'Open Manage markets (Locations), find the state or city, turn on "Market is live" and turn off "Hide from search engines". The public site updates within a minute.'],
  ['Run a promotion', 'Promotions has three types. Sponsored cards and organic pins need a provider. Ad banners need an image and a link. Slot limits are enforced so you cannot oversell.'],
  ['Action a lead', 'New bookings show in the New leads card. Open the booking, read the request, then set its status to confirmed or completed.'],
  ['Clear an alert', 'Data Alerts lists what is wrong with the data. Fix the underlying record, then click Re-scan alerts or mark the alert resolved.'],
  ['Import AI content (guides/news)', 'Content import: upload a JSON file matching ContentImportPayload. Items arrive as "imported" (not public, 404 on site). Dry run previews first. After commit, use Content review to approve.'],
  ['Approve content', 'Content review: approving sets reviewStatus=approved and makes the page public. The page emits noindex so Google ignores it. Items sit here until drip-indexed.'],
  ['Drip indexing', 'Drip indexer: flips oldest approved+noindex items to indexed (Google can crawl them). Run 5-10 per day per collection. CLI: npm run drip:index -- guides --count=5.'],
]
