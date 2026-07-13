'use client'

import { useEffect, useState } from 'react'
import { box } from '../ui/styles'

type BulkUploadCollection = 'clinics' | 'reviews'

type BulkUploadItem = {
  id: number
  stableId: string
  label: string
  status: string
}

type BulkUploadReport = {
  collection: BulkUploadCollection
  batch: string
  total: number
  created: number
  updated: number
  skipped: number
  skippedUnmatched: number
  failed: number
  aggregateUpdates?: number
  errors: Array<{ line: number; stableId?: string; reason: string }>
  items: BulkUploadItem[]
}

const BULK_UPLOAD_COLLECTIONS: Array<{ key: BulkUploadCollection; label: string }> = [
  { key: 'clinics', label: 'Clinics' },
  { key: 'reviews', label: 'Reviews' },
]

// -- Data tools: backup, re-scan, scoped wipe -------------------------------
export function DataToolsPanel({ onAfterChange }: { onAfterChange: () => void }) {
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
    <div style={{ ...box, borderLeft: '4px solid #C2A14E' }}>
      <strong style={{ fontSize: 15 }}>Data tools</strong>
      <div style={{ fontSize: 13, opacity: 0.8, margin: '4px 0 14px' }}>
        Back up, re-scan integrity, and reset directory data (for the launch-day fake → real swap). Every action is admin-only and logged.
      </div>

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

      <div style={{ border: '1px solid #B91C1C33', borderRadius: 8, padding: 14, background: '#B91C1C0a' }}>
        <BulkUploadManager onAfterChange={onAfterChange} />
      </div>

      <div style={{ border: '1px solid #B91C1C33', borderRadius: 8, padding: 14, background: '#B91C1C0a' }}>
        <strong style={{ fontSize: 14, color: '#B91C1C' }}>Wipe directory data (destructive)</strong>
        <div style={{ fontSize: 12, opacity: 0.8, margin: '4px 0 12px' }}>
          Deletes clinics, providers, reviews, photos, Q&amp;A, before/after, bookings, claims, promotions, and alerts.
          Preserves users, services, locations, guides, authors, reviewers, FAQs, media. An automatic backup is taken before any real wipe.
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

function BulkUploadManager({ onAfterChange }: { onAfterChange: () => void }) {
  const [files, setFiles] = useState<Partial<Record<BulkUploadCollection, File>>>({})
  const [reports, setReports] = useState<Partial<Record<BulkUploadCollection, BulkUploadReport>>>({})
  const [busy, setBusy] = useState<string>('')
  const [msg, setMsg] = useState('')

  async function upload(collection: BulkUploadCollection) {
    const file = files[collection]
    if (!file) {
      setMsg(`Select a ${collection} CSV first.`)
      return
    }
    setBusy(`upload:${collection}`)
    setMsg('')
    try {
      const fd = new FormData()
      fd.set('collection', collection)
      fd.set('file', file)
      const res = await fetch('/api/admin/import', { method: 'POST', body: fd, credentials: 'include' })
      const json = await res.json()
      if (!res.ok) {
        setMsg(json.error || 'Upload failed.')
        return
      }
      setReports((prev) => ({ ...prev, [collection]: json.report as BulkUploadReport }))
      setMsg(`${collection} upload staged. Review the summary, then approve when ready.`)
      onAfterChange()
    } catch {
      setMsg('Network error during upload.')
    } finally {
      setBusy('')
    }
  }

  async function approve(collection: BulkUploadCollection, opts: { batch?: string; id?: number }) {
    setBusy(opts.id ? `approve:${collection}:${opts.id}` : `approve:${collection}`)
    setMsg('')
    try {
      const res = await fetch('/api/admin/import/approve', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection,
          batch: opts.batch,
          ids: opts.id ? [opts.id] : undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setMsg(json.error || 'Approve failed.')
        return
      }
      const report = reports[collection]
      if (report && json.report?.items) {
        setReports((prev) => ({
          ...prev,
          [collection]: {
            ...report,
            items: json.report.items as BulkUploadItem[],
            aggregateUpdates: json.report.aggregateUpdates ?? report.aggregateUpdates,
          },
        }))
      }
      const approved = json.report?.approved ?? 0
      const aggregates = json.report?.aggregateUpdates ? ` Aggregate rows updated: ${json.report.aggregateUpdates}.` : ''
      setMsg(`Approved ${approved} ${collection} item${approved === 1 ? '' : 's'}.${aggregates}`)
      onAfterChange()
    } catch {
      setMsg('Network error during approval.')
    } finally {
      setBusy('')
    }
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <strong style={{ fontSize: 14, color: '#0B1B34' }}>Bulk CSV upload and approval</strong>
      <div style={{ fontSize: 12, opacity: 0.8, margin: '4px 0 12px' }}>
        Uploads stage as draft or pending only. Publish requires an explicit approval step. Indexing stays off by default.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
        {BULK_UPLOAD_COLLECTIONS.map(({ key, label }) => {
          const report = reports[key]
          const isUploading = busy === `upload:${key}`
          const isApproving = busy === `approve:${key}`
          return (
            <div key={key} style={{ border: '1px solid #0B1B341f', borderRadius: 8, padding: 12, background: '#fff' }}>
              <strong style={{ fontSize: 13 }}>{label}</strong>
              <div style={{ marginTop: 8 }}>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setFiles((prev) => ({ ...prev, [key]: e.target.files?.[0] }))}
                  style={{ fontSize: 12, maxWidth: '100%' }}
                />
              </div>
              <button type="button" disabled={!!busy} onClick={() => upload(key)} style={{ ...btn(isUploading, '#3FA68A'), marginTop: 8 }}>
                {isUploading ? 'Uploading...' : 'Upload and stage'}
              </button>

              {report && (
                <div style={{ marginTop: 10, fontSize: 12 }}>
                  <div style={{ fontWeight: 600 }}>Batch {report.batch}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 4, marginTop: 6 }}>
                    <span>Total: <strong>{report.total}</strong></span>
                    <span>Created: <strong>{report.created}</strong></span>
                    <span>Updated: <strong>{report.updated}</strong></span>
                    <span>Skipped: <strong>{report.skipped + report.skippedUnmatched}</strong></span>
                    <span>Failed: <strong>{report.failed}</strong></span>
                    {report.aggregateUpdates !== undefined && <span>Aggregates: <strong>{report.aggregateUpdates}</strong></span>}
                  </div>

                  {report.errors.length > 0 && (
                    <details style={{ marginTop: 8 }}>
                      <summary style={{ cursor: 'pointer' }}>Validation errors ({report.errors.length} shown)</summary>
                      <ul style={{ margin: '6px 0 0', paddingLeft: 16 }}>
                        {report.errors.slice(0, 8).map((error, index) => (
                          <li key={`${error.line}-${index}`}>
                            line {error.line}{error.stableId ? ` (${error.stableId})` : ''}: {error.reason}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}

                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => approve(key, { batch: report.batch })}
                    style={{ ...btn(isApproving, '#0B1B34'), marginTop: 10 }}
                  >
                    {isApproving ? 'Approving...' : 'Approve all staged'}
                  </button>

                  {report.items.length > 0 && (
                    <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                      {report.items.slice(0, 6).map((item) => {
                        const itemBusy = busy === `approve:${key}:${item.id}`
                        return (
                          <div key={item.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, alignItems: 'center' }}>
                            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.label} <span style={{ opacity: 0.65 }}>({item.status})</span>
                            </span>
                            <button type="button" disabled={!!busy} onClick={() => approve(key, { id: item.id })} style={btn(itemBusy, '#3FA68A')}>
                              {itemBusy ? '...' : 'Approve'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {msg && <p style={{ fontSize: 13, margin: '12px 0 0' }}>{msg}</p>}
    </div>
  )
}

function btn(busy: boolean, bg = '#0B1B34', disabled = false): React.CSSProperties {
  const off = busy || disabled
  return {
    padding: '9px 18px', borderRadius: 999, border: 'none', cursor: off ? 'default' : 'pointer',
    background: bg, color: '#fff', fontSize: 13, fontWeight: 600, opacity: off ? 0.55 : 1,
  }
}
